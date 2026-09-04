const axios = require('axios');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

// Initialize Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmbx0y0v3',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Validates Meta X-Hub-Signature-256 header using the Meta App Secret.
 * @param {Buffer|string} rawBody - Raw request body buffer or string.
 * @param {string} signatureHeader - The 'x-hub-signature-256' header.
 * @param {string} appSecret - Meta App Secret.
 * @returns {boolean} True if signature is valid.
 */
function validateMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) {
    console.warn('[MetaService] META_APP_SECRET is not configured; skipping signature verification.');
    return true;
  }
  if (!signatureHeader) {
    console.error('[MetaService] Missing x-hub-signature-256 header.');
    return false;
  }

  const parts = signatureHeader.split('sha256=');
  if (parts.length !== 2) {
    console.error('[MetaService] Invalid signature header format.');
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac('sha256', appSecret);
  const data = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  const calculatedSignature = hmac.update(data).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (err) {
    console.error('[MetaService] Error comparing signatures:', err);
    return false;
  }
}

/**
 * Two-step media retrieval:
 * 1. Fetch temporary download URL for mediaId from Meta Graph API v20.0
 * 2. Download binary stream and pipe to Cloudinary under 'tec_weekly_updates' folder
 * @param {string} mediaId - Meta media ID
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function fetchAndUploadMedia(mediaId) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('META_ACCESS_TOKEN is required to download media from Meta.');
  }

  // Step 1: Query Graph API for media metadata URL
  const metaMetadataUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
  const metaRes = await axios.get(metaMetadataUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000
  });

  const downloadUrl = metaRes.data?.url;
  if (!downloadUrl) {
    throw new Error(`Failed to obtain media download URL for ID: ${mediaId}`);
  }

  // Step 2: Download raw binary stream with Auth header
  const imageRes = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
    timeout: 30000
  });

  // Step 3: Stream binary directly into Cloudinary
  const uploadRes = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'tec_weekly_updates',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(Buffer.from(imageRes.data));
  });

  return {
    secure_url: uploadRes.secure_url,
    public_id: uploadRes.public_id
  };
}

/**
 * Module 4: Sends an approved Meta WhatsApp Template message.
 * @param {string} recipientId - WhatsApp user phone number (E.164 format)
 * @param {string} templateName - Approved template name (e.g. deadline_alert)
 * @param {Array} components - Template variable components
 */
async function sendMetaTemplate(recipientId, templateName, components = []) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: recipientId,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: components
    }
  };

  return await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });
}

/**
 * Module 4: Sends a freeform WhatsApp text response within the 24h customer service window.
 * @param {string} recipientId - WhatsApp user phone number
 * @param {string} text - Response text
 */
async function sendMetaTextMessage(recipientId, text, phoneNumberIdOverride = null) {
  const phoneNumberId = phoneNumberIdOverride || process.env.PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientId,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  };

  try {
    console.log(`[MetaService] Sending WhatsApp reply to ${recipientId} via Phone ID ${phoneNumberId}...`);
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    console.log(`[MetaService] Reply successfully delivered to ${recipientId}:`, res.data);
    return res;
  } catch (err) {
    console.error(`[MetaService] Error sending WhatsApp reply to ${recipientId}:`, err?.response?.data || err.message);
    throw err;
  }
}

/**
 * Module 4: Batch broadcast utility for moderator alerts.
 * @param {string[]} userIds - Array of recipient phone numbers
 * @param {string} template - Template name
 * @param {Array} components - Optional template components
 */
async function broadcastUpdate(userIds, template, components = []) {
  const results = [];
  for (const id of userIds) {
    try {
      const res = await sendMetaTemplate(id, template, components);
      results.push({ id, status: 'success', data: res.data });
    } catch (err) {
      console.error(`[MetaService] Failed to broadcast to ${id}:`, err?.response?.data || err.message);
      results.push({ id, status: 'failed', error: err?.response?.data || err.message });
    }
  }
  return results;
}

module.exports = {
  validateMetaSignature,
  fetchAndUploadMedia,
  sendMetaTemplate,
  sendMetaTextMessage,
  broadcastUpdate
};
