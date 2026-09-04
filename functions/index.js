require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase] Admin initialized with Service Account.');
    } catch (e) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
      admin.initializeApp();
    }
  } else {
    admin.initializeApp();
  }
}

const {
  validateMetaSignature,
  fetchAndUploadMedia,
  sendMetaTextMessage,
  sendMetaTemplate,
  broadcastUpdate
} = require('./services/metaService');

const {
  generateFacilitatorResponse
} = require('./services/geminiEngine');

const {
  checkDeadlinesAndAlertUsers,
  sendOrderConfirmation,
  sendMilestoneCelebration
} = require('./services/automationService');

/**
 * Core WhatsApp Webhook Handler Logic
 * Handles both GET challenge handshake and POST inbound message processing.
 */
async function handleWhatsAppWebhook(req, res) {
  // -------------------------------------------------------------
  // 1. GET Handshake Validation (Meta Requirement)
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Handshake validated successfully.');
      return res.status(200).send(challenge);
    }

    console.warn('[Webhook] Handshake failed: Token mismatch or invalid mode.');
    return res.status(403).send('Forbidden');
  }

  // -------------------------------------------------------------
  // 2. POST Message Handler with Media Synchronization & AI Loop
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.META_APP_SECRET;

    // Validate Meta X-Hub-Signature-256
    const isSignatureValid = validateMetaSignature(
      req.rawBody || JSON.stringify(req.body),
      signature,
      appSecret
    );

    if (!isSignatureValid) {
      console.error('[Webhook] Invalid X-Hub-Signature-256 received. Rejecting request.');
      return res.status(403).send('Invalid signature');
    }

    const payload = req.body;
    console.log('[Webhook] Received POST payload from Meta');
    const changeValue = payload.entry?.[0]?.changes?.[0]?.value;
    const message = changeValue?.messages?.[0];
    const phoneNumberId = changeValue?.metadata?.phone_number_id || process.env.PHONE_NUMBER_ID;

    // Check if this is an incoming user message (and not a status receipt)
    if (message) {
      const userId = message.from; // User's WhatsApp phone number (E.164)
      const messageType = message.type;
      console.log(`[Webhook] Processing incoming ${messageType} message from ${userId} (Phone ID: ${phoneNumberId})...`);

      try {
        if (messageType === 'text') {
          const incomingText = message.text?.body || '';

          // Auto-linking: Check if member sent their registered email address
          const emailRegex = /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/;
          const emailMatch = incomingText.match(emailRegex);
          if (emailMatch) {
            const targetEmail = emailMatch[0].toLowerCase();
            try {
              const db = admin.firestore();
              const userQuery = await db.collection('users').where('email', '==', targetEmail).limit(1).get();
              if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                await userDoc.ref.update({
                  phoneNumber: userId,
                  whatsappNumber: userId
                });
                const memberName = userDoc.data().displayName || userDoc.data().name || 'Member';
                console.log(`[Webhook] Linked phone ${userId} to user ${userDoc.id} (${targetEmail})`);
                await sendMetaTextMessage(
                  userId,
                  `✅ Account linked successfully!\n\nWelcome, ${memberName}. Your WhatsApp number is now connected to your TEC Weekly account (${targetEmail}). Every update and proof you send here will count toward your goals.`,
                  phoneNumberId
                );
                return res.status(200).send('EVENT_RECEIVED');
              }
            } catch (linkErr) {
              console.warn('[Webhook] Failed to link user by email:', linkErr.message);
            }
          }

          // A. Store incoming message into 'messages' collection (Safe)
          try {
            const db = admin.firestore();
            await db.collection('messages').add({
              userId,
              text: incomingText,
              rawMessageId: message.id,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Webhook] Stored message in Firestore for ${userId}`);
          } catch (dbErr) {
            console.warn('[Webhook] Firestore write skipped/unavailable:', dbErr.message);
          }

          // B. Trigger Gemini Conversational Engine & Reply
          const aiReply = await generateFacilitatorResponse({
            userId,
            incomingMessage: incomingText,
            hasImage: false
          });

          if (aiReply) {
            await sendMetaTextMessage(userId, aiReply, phoneNumberId);
          }

        } else if (messageType === 'image') {
          const mediaId = message.image?.id;
          const caption = message.image?.caption || '';

          // A. Two-step media retrieval: Meta Graph API -> Cloudinary
          let imageUrl = null;
          let publicId = null;
          try {
            const uploadRes = await fetchAndUploadMedia(mediaId);
            imageUrl = uploadRes.secure_url;
            publicId = uploadRes.public_id;
          } catch (mediaErr) {
            console.error('[Webhook] Error streaming media to Cloudinary:', mediaErr.message);
          }

          // B. Store media submission into 'updates' collection (Safe)
          try {
            const db = admin.firestore();
            await db.collection('updates').add({
              userId,
              imageUrl: imageUrl,
              cloudinaryPublicId: publicId,
              caption: caption,
              type: 'image_update',
              rawMessageId: message.id,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Webhook] Stored image update in Firestore for ${userId}`);
          } catch (dbErr) {
            console.warn('[Webhook] Firestore write skipped/unavailable:', dbErr.message);
          }

          // C. Trigger Gemini Conversational Engine with visual proof context & Reply
          const aiReply = await generateFacilitatorResponse({
            userId,
            incomingMessage: caption,
            hasImage: true,
            imageUrl: imageUrl
          });

          if (aiReply) {
            await sendMetaTextMessage(userId, aiReply, phoneNumberId);
          }
        }
      } catch (processingErr) {
        console.error(`[Webhook] Error processing ${messageType} message from ${userId}:`, processingErr);
      }
    }

    // Always respond 200 OK immediately to Meta to acknowledge event delivery
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method Not Allowed');
}

// Module 2: Export Cloud Function for Firebase
exports.whatsappWebhook = functions.https.onRequest(handleWhatsAppWebhook);

// Export core handler for standalone Express server (Render, Railway, local tunnel)
exports.handleWhatsAppWebhook = handleWhatsAppWebhook;

// -------------------------------------------------------------
// Scheduled Tasks & Automation Layer
// -------------------------------------------------------------

let onSchedule;
try {
  ({ onSchedule } = require('firebase-functions/v2/scheduler'));
} catch (_) {}

if (onSchedule) {
  exports.scheduledDeadlineChecker = onSchedule(
    { schedule: 'every 1 hours', timeZone: 'Africa/Lagos' },
    async (event) => {
      console.log('[Scheduler] Executing scheduled deadline checks.');
      const result = await checkDeadlinesAndAlertUsers();
      console.log('[Scheduler] Deadline check completed:', result);
    }
  );
}

/**
 * Manual HTTPS trigger for administrative deadline checks.
 */
exports.triggerDeadlineCheck = functions.https.onRequest(async (req, res) => {
  const result = await checkDeadlinesAndAlertUsers();
  return res.status(200).json(result);
});

// Module 4: Export Outbound Messaging & Notification utilities
exports.sendMetaTemplate = sendMetaTemplate;
exports.sendMetaTextMessage = sendMetaTextMessage;
exports.broadcastUpdate = broadcastUpdate;
exports.sendOrderConfirmation = sendOrderConfirmation;
exports.sendMilestoneCelebration = sendMilestoneCelebration;
