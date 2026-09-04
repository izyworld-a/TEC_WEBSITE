const admin = require('firebase-admin');
const { sendMetaTemplate } = require('./metaService');

/**
 * Checks approaching deadlines and automatically sends WhatsApp 'deadline_alert' templates
 * to active circle members who haven't completed their setup or submissions.
 */
async function checkDeadlinesAndAlertUsers() {
  const db = admin.firestore();
  const now = new Date();

  console.log(`[Automation] Checking deadlines at ${now.toISOString()}`);

  // 1. Fetch current week settings
  const weekSettingsSnap = await db.collection('week_settings').get();
  if (weekSettingsSnap.empty) {
    console.log('[Automation] No week settings configured.');
    return { status: 'no_settings', alertedCount: 0 };
  }

  let alertedCount = 0;

  for (const doc of weekSettingsSnap.docs) {
    const settings = doc.data();
    const setupDeadline = settings.setupDeadline ? new Date(settings.setupDeadline) : null;
    const completionDeadline = settings.completionDeadline ? new Date(settings.completionDeadline) : null;

    // Check if setup deadline is within 6 hours
    const isSetupApproaching = setupDeadline && (setupDeadline - now > 0) && (setupDeadline - now <= 6 * 3600 * 1000);
    // Check if completion deadline is within 6 hours
    const isCompletionApproaching = completionDeadline && (completionDeadline - now > 0) && (completionDeadline - now <= 6 * 3600 * 1000);

    if (isSetupApproaching || isCompletionApproaching) {
      const deadlineType = isSetupApproaching ? 'Goal Setup Deadline' : 'Goal Completion Deadline';
      const deadlineTimeStr = (isSetupApproaching ? setupDeadline : completionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Fetch active users with phone numbers
      const usersSnap = await db.collection('users')
        .where('status', '==', 'Active')
        .get();

      for (const userDoc of usersSnap.docs) {
        const u = userDoc.data();
        const phoneNumber = u.phoneNumber || u.whatsappNumber;

        if (phoneNumber) {
          try {
            // Template: deadline_alert
            // Parameters: [MemberName, DeadlineType, DeadlineTime]
            await sendMetaTemplate(phoneNumber, 'deadline_alert', [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: u.displayName || u.name || 'Member' },
                  { type: 'text', text: deadlineType },
                  { type: 'text', text: deadlineTimeStr }
                ]
              }
            ]);
            alertedCount++;
          } catch (err) {
            console.error(`[Automation] Failed to send deadline alert to ${phoneNumber}:`, err.message);
          }
        }
      }
    }
  }

  return { status: 'success', alertedCount };
}

/**
 * Dispatches the Meta 'order_confirmation' template when a membership or wallet order is placed.
 * @param {string} phoneNumber - WhatsApp recipient phone number (E.164)
 * @param {object} orderDetails - Order information
 */
async function sendOrderConfirmation(phoneNumber, { memberName, amount, orderId }) {
  return await sendMetaTemplate(phoneNumber, 'order_confirmation', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: memberName },
        { type: 'text', text: String(amount) },
        { type: 'text', text: orderId }
      ]
    }
  ]);
}

/**
 * Dispatches the Meta 'milestone_reached' template when a member successfully completes their goal.
 * @param {string} phoneNumber - WhatsApp recipient phone number (E.164)
 * @param {object} milestone - Milestone info
 */
async function sendMilestoneCelebration(phoneNumber, { memberName, goalTitle, pointsAwarded }) {
  return await sendMetaTemplate(phoneNumber, 'milestone_reached', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: memberName },
        { type: 'text', text: goalTitle },
        { type: 'text', text: `+${pointsAwarded} Points` }
      ]
    }
  ]);
}

module.exports = {
  checkDeadlinesAndAlertUsers,
  sendOrderConfirmation,
  sendMilestoneCelebration
};
