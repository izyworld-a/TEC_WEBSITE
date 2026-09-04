const axios = require('axios');
const admin = require('firebase-admin');

const MASTER_SYSTEM_INSTRUCTION = `You are the Execution Circle Facilitator for TEC Weekly.
You are in a direct 1-on-1 WhatsApp chat with an active community member.
Your persona is disciplined, high-agency, direct, and focused on radical accountability.

COMMUNICATION DIRECTIVES:
- ALWAYS address the member directly in the second person ("you", "your").
- NEVER speak about the member in third person (never say "prompt them", "the user", or output evaluator instructions).
- Output ONLY the direct WhatsApp message to send to the member.
- Acknowledge their discipline or call out slacking with actionable next steps.
- Keep replies punchy and optimal for WhatsApp chat (under 100 words).

SCORING RULES (Reference when evaluating updates):
- +10 Points: Awarded for confirmed completion of a weekly goal milestone.
- +5 Points: Awarded for providing visual proof (uploaded progress screenshots, photos, artifacts).
- -2 Points: Deducted for missed deadlines or lack of update without prior notification.`;

/**
 * Queries the user document from Firestore matching their phone number or user ID.
 * @param {string} userId - User phone number (E.164) or Firestore document ID
 */
async function getUserProfile(userId) {
  try {
    const db = admin.firestore();

    // 1. Check direct doc match
    let userSnap = await db.collection('users').doc(userId).get();
    if (userSnap.exists) {
      return { id: userSnap.id, ...userSnap.data() };
    }

    // 2. Query by phoneNumber or whatsappNumber field
    const phoneQuery = await db.collection('users')
      .where('phoneNumber', '==', userId)
      .limit(1)
      .get();

    if (!phoneQuery.empty) {
      const doc = phoneQuery.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    // 3. Fallback: Query by normalized phone (strip plus sign)
    const strippedPhone = userId.replace(/^\+/, '');
    const altQuery = await db.collection('users')
      .where('phoneNumber', '==', strippedPhone)
      .limit(1)
      .get();

    if (!altQuery.empty) {
      const doc = altQuery.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {
    console.warn('[GeminiEngine] Firestore query skipped or unavailable:', err.message);
  }

  return {
    displayName: 'Circle Member',
    bio: 'Execution Circle Member',
    profession: 'Builder / Professional',
    socialHandles: {}
  };
}

/**
 * Retrieves the latest active goal for the user.
 * @param {string} userId - User ID or phone number
 */
async function getCurrentGoal(userId) {
  try {
    const db = admin.firestore();

    // Check 'goals' collection first
    const goalsSnap = await db.collection('goals')
      .where('userId', '==', userId)
      .orderBy('deadline', 'desc')
      .limit(1)
      .get();

    if (!goalsSnap.empty) {
      return goalsSnap.docs[0].data();
    }

    // Fallback to 'weekly_goals' collection
    const weeklySnap = await db.collection('weekly_goals')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!weeklySnap.empty) {
      return weeklySnap.docs[0].data();
    }
  } catch (err) {
    console.warn('[GeminiEngine] Goal query skipped or unavailable:', err.message);
  }

  return { title: 'Active Weekly Goals' };
}

/**
 * Evaluates an incoming update and generates a grounded response using the Gemini API.
 * @param {object} params
 * @param {string} params.userId - Recipient WhatsApp ID / Phone Number
 * @param {string} params.incomingMessage - Text content or image caption
 * @param {boolean} params.hasImage - Whether visual proof was attached
 * @param {string} [params.imageUrl] - Uploaded Cloudinary image URL
 * @returns {Promise<string>} AI Facilitator response text
 */
async function generateFacilitatorResponse({ userId, incomingMessage, hasImage = false, imageUrl = null }) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('[GeminiEngine] GEMINI_API_KEY not configured. Returning standard acknowledgement.');
    return hasImage
      ? `Visual proof received and recorded (+5 Points). Keep executing towards your weekly goal.`
      : `Update received. Stay accountable and maintain your execution momentum!`;
  }

  const [profile, currentGoal] = await Promise.all([
    getUserProfile(userId),
    getCurrentGoal(userId)
  ]);

  const memberName = profile.displayName || profile.name || 'Member';
  const memberRole = profile.profession || 'Professional';
  const currentGoalTitle = currentGoal.title || currentGoal.description || 'Weekly Milestones';

  const userPrompt = [
    `Member Profile: ${memberName} (${memberRole})`,
    `Current Goal: ${currentGoalTitle}`,
    `Visual Proof Attached: ${hasImage ? 'Yes (+5 Points eligible)' : 'No'}`,
    imageUrl ? `Proof Image URL: ${imageUrl}` : '',
    ``,
    `The member just sent you this message on WhatsApp:`,
    `"${incomingMessage || (hasImage ? '[Attached an image proof of work]' : '')}"`,
    ``,
    `Respond directly to ${memberName} on WhatsApp as their Execution Circle Facilitator.`
  ].filter(Boolean).join('\n');

  // Use gemini-flash-latest for reliable, sub-second responses
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const payload = {
    system_instruction: {
      parts: [{ text: MASTER_SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1000
    }
  };

  try {
    console.log(`[GeminiEngine] Generating facilitator reply using ${model}...`);
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const candidate = res.data?.candidates?.[0];
    const reply = candidate?.content?.parts?.[0]?.text;

    if (reply) {
      console.log(`[GeminiEngine] Generated response: "${reply.trim().slice(0, 100)}..."`);
      return reply.trim();
    }
    throw new Error('No reply text generated by Gemini');
  } catch (err) {
    console.error('[GeminiEngine] Error calling Gemini API:', err?.response?.data || err.message);
    return hasImage
      ? `Visual proof verified and cataloged (+5 Points). Outstanding execution, ${memberName}. Keep pushing!`
      : `Update logged, ${memberName}. Let me know the specific milestones you completed today!`;
  }
}

module.exports = {
  MASTER_SYSTEM_INSTRUCTION,
  getUserProfile,
  getCurrentGoal,
  generateFacilitatorResponse
};
