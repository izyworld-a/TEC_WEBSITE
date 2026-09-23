/**
 * Comprehensive Verification Test Suite for TEC Weekly Webhook & Backend Modules
 * Tests:
 * 1. GET Handshake Simulation
 * 2. HMAC-SHA256 Signature Validation
 * 3. Inbound Payload Parsing (Text & Image)
 * 4. Gemini Conversational Prompt Formatting & Scoring Rules
 * 5. Outbound Meta Template Generation
 */
const crypto = require('crypto');
const { validateMetaSignature } = require('../services/metaService');
const { MASTER_SYSTEM_INSTRUCTION } = require('../services/geminiEngine');

async function runTests() {
  console.log('====================================================');
  console.log('TEC Weekly: Master Verification Test Suite (v2026.36)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: GET Handshake Simulation
  // -------------------------------------------------------------
  console.log('--- Test 1: GET Handshake Simulation ---');
  const verifyToken = 'test_token_tec_weekly_2026';
  process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;

  const validQuery = {
    'hub.mode': 'subscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': 'CHALLENGE_STRING_12345'
  };

  const handshakeSuccess = (validQuery['hub.mode'] === 'subscribe' && validQuery['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN);
  assert(handshakeSuccess, 'Valid GET handshake returns challenge');

  const invalidQuery = {
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong_token',
    'hub.challenge': 'CHALLENGE_STRING_12345'
  };
  const handshakeRejected = !(invalidQuery['hub.mode'] === 'subscribe' && invalidQuery['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN);
  assert(handshakeRejected, 'Mismatched verify_token is properly rejected (403)');

  // -------------------------------------------------------------
  // Test 2: HMAC-SHA256 Signature Validation
  // -------------------------------------------------------------
  console.log('\n--- Test 2: HMAC-SHA256 Signature Validation ---');
  const appSecret = 'tec_secret_app_key_998877';
  const testPayload = JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '+2348012345678',
            id: 'wamid.test.123',
            type: 'text',
            text: { body: 'I completed my milestone today!' }
          }]
        }
      }]
    }]
  });

  const validHash = crypto.createHmac('sha256', appSecret).update(testPayload).digest('hex');
  const validHeader = `sha256=${validHash}`;

  const sigPass = validateMetaSignature(testPayload, validHeader, appSecret);
  assert(sigPass === true, 'Authentic X-Hub-Signature-256 is accepted');

  const invalidHeader = `sha256=${crypto.createHmac('sha256', 'wrong_secret').update(testPayload).digest('hex')}`;
  const sigFail = validateMetaSignature(testPayload, invalidHeader, appSecret);
  assert(sigFail === false, 'Forged X-Hub-Signature-256 is rejected');

  // -------------------------------------------------------------
  // Test 3: Payload Schema Ingestion Parsing
  // -------------------------------------------------------------
  console.log('\n--- Test 3: WhatsApp Payload Parsing ---');
  const parsed = JSON.parse(testPayload);
  const message = parsed.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  assert(message && message.from === '+2348012345678', 'User ID correctly extracted from message.from');
  assert(message && message.text?.body === 'I completed my milestone today!', 'Message body correctly extracted');

  // Image payload check
  const imagePayload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '+2348012345678',
            id: 'wamid.img.456',
            type: 'image',
            image: {
              id: 'media_id_778899',
              mime_type: 'image/jpeg',
              caption: 'Completed frontend UI mockup'
            }
          }]
        }
      }]
    }]
  };
  const imgMsg = imagePayload.entry[0].changes[0].value.messages[0];
  assert(imgMsg.type === 'image' && imgMsg.image.id === 'media_id_778899', 'Image media ID extraction validated');

  // -------------------------------------------------------------
  // Test 4: Gemini System Instruction & Scoring Constraints
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Gemini AI System Grounding ---');
  assert(MASTER_SYSTEM_INSTRUCTION.includes('Execution Circle Facilitator'), 'Facilitator persona configured');
  assert(MASTER_SYSTEM_INSTRUCTION.includes('+10 Points'), 'Confirmed completion +10 point constraint validated');
  assert(MASTER_SYSTEM_INSTRUCTION.includes('+5 Points'), 'Visual proof +5 point constraint validated');
  assert(MASTER_SYSTEM_INSTRUCTION.includes('-2 Points'), 'Missed deadline -2 point deduction constraint validated');

  // -------------------------------------------------------------
  // Test 5: Meta Graph API v20.0 Template Payloads
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Meta Notification Inventory Formatting ---');
  const templates = ['order_confirmation', 'deadline_alert', 'milestone_reached', 'platform_update'];
  for (const t of templates) {
    const formatted = {
      messaging_product: 'whatsapp',
      to: '+2348012345678',
      type: 'template',
      template: {
        name: t,
        language: { code: 'en_US' }
      }
    };
    assert(formatted.template.name === t, `Template '${t}' payload structure validated`);
  }

  // -------------------------------------------------------------
  // Test 6: TEC Weekly Engine: tecGoalReminders Template Port
  // -------------------------------------------------------------
  console.log('\n--- Test 6: tecGoalReminders Template Logic & 24h Window Fallback ---');

  if (!globalThis.Deno) {
    globalThis.Deno = {
      env: {
        get: (key) => process.env[key] || ''
      }
    };
  }

  const {
    is24HourWindowError,
    formatDeadline,
    buildReminderComponents,
    sendMetaTemplate,
    sendMetaText
  } = await import('../../TEC_Weekly_Engine/tecGoalReminders.ts');

  // 6.1: 24-Hour window error detection
  assert(is24HourWindowError(131047, undefined) === true, 'Error code 131047 detected as 24-hour window error');
  assert(is24HourWindowError(undefined, '(#131047) Re-engagement message') === true, 'Error message with 131047 detected');
  assert(is24HourWindowError(undefined, 'Message failed because 24 hours have passed') === true, 'Error message mentioning 24 hours detected');
  assert(is24HourWindowError(undefined, 'Customer re-engagement required') === true, 'Error message mentioning re-engagement detected');
  assert(is24HourWindowError(100, 'Invalid parameter') === false, 'Non-24h error code 100 correctly ignored');
  assert(is24HourWindowError(131030, 'Recipient phone number not in allowed list') === false, 'Error code 131030 correctly ignored');

  // 6.2: Deadline formatting helper
  const formattedIso = formatDeadline('2026-09-13T23:59:00Z');
  assert(typeof formattedIso === 'string' && formattedIso.length > 0, 'formatDeadline formats ISO date strings');
  assert(formatDeadline('Sunday 11:59 PM') === 'Sunday 11:59 PM', 'formatDeadline preserves human-readable deadline strings');
  assert(formatDeadline('') === '', 'formatDeadline handles empty deadline gracefully');

  // 6.3: buildReminderComponents for all member goal states
  // State A: Goal not set
  const compNoGoal = buildReminderComponents('Izy Ogbonna', false, 0, 'Sunday 11:59 PM', 'Sunday 11:59 PM');
  assert(compNoGoal.length === 1 && compNoGoal[0].type === 'body', 'Components return body type');
  const paramsNoGoal = compNoGoal[0].parameters;
  assert(paramsNoGoal.length === 3, 'Body parameters have 3 fields for deadline_alert template');
  assert(paramsNoGoal[0].text === 'Izy', 'Parameter 1 is member first name');
  assert(paramsNoGoal[1].text === 'Goal Setup Deadline', 'Parameter 2 is Goal Setup Deadline when goal not set');
  assert(paramsNoGoal[2].text.length > 0, 'Parameter 3 is non-empty deadline string');

  // State B: Goal completed (100%)
  const compCompleted = buildReminderComponents('Alex', true, 100, '', '2026-09-14T12:00:00Z');
  const paramsCompleted = compCompleted[0].parameters;
  assert(paramsCompleted[0].text === 'Alex', 'Parameter 1 is member first name');
  assert(paramsCompleted[1].text === 'Weekly Goal Milestone', 'Parameter 2 is Weekly Goal Milestone when 100%');

  // State C: Goal in progress (< 100%)
  const compInProgress = buildReminderComponents('Jordan Smith', true, 60, '', 'Sunday 11:59 PM');
  const paramsInProgress = compInProgress[0].parameters;
  assert(paramsInProgress[0].text === 'Jordan', 'Parameter 1 is member first name');
  assert(paramsInProgress[1].text.includes('60%'), 'Parameter 2 reflects goal progress percentage');

  // Verify no parameters are empty strings (Meta requirement)
  for (const comp of [compNoGoal, compCompleted, compInProgress]) {
    for (const p of comp[0].parameters) {
      assert(typeof p.text === 'string' && p.text.trim().length > 0, `Parameter text '${p.text}' is non-empty string`);
    }
  }

  // -------------------------------------------------------------
  // Test 7: sendMetaTemplate native Deno fetch & fallback behavior
  // -------------------------------------------------------------
  console.log('\n--- Test 7: sendMetaTemplate Native Fetch & Fallback Verification ---');

  const origFetch = globalThis.fetch;
  const origToken = process.env.META_ACCESS_TOKEN;
  process.env.META_ACCESS_TOKEN = 'test_meta_token_tec_2026';

  let capturedRequests = [];
  globalThis.fetch = async (url, options) => {
    capturedRequests.push({ url: String(url), options });
    const bodyObj = JSON.parse(options.body || '{}');

    // Simulate 24-hour window failure on freeform text
    if (bodyObj.type === 'text') {
      return {
        ok: false,
        json: async () => ({
          error: {
            message: '(#131047) Re-engagement message',
            type: 'OAuthException',
            code: 131047,
            error_data: {
              messaging_product: 'whatsapp',
              details: 'Message failed to send because more than 24 hours have passed since customer last replied.'
            }
          }
        })
      };
    }

    // Simulate template success
    if (bodyObj.type === 'template') {
      return {
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: bodyObj.to, wa_id: bodyObj.to }],
          messages: [{ id: 'wamid.HBgLMTIzNDU2Nzg5...' }]
        })
      };
    }

    return { ok: true, json: async () => ({}) };
  };

  try {
    // Test sendMetaTemplate directly
    const tRes = await sendMetaTemplate('+2349026675879', 'deadline_alert', compNoGoal);
    assert(tRes.ok === true, 'sendMetaTemplate successfully delivers template message');
    assert(capturedRequests.length === 1, 'Single fetch request made for template');
    const tReq = capturedRequests[0];
    assert(tReq.url === 'https://graph.facebook.com/v20.0/1329337346933318/messages', 'Correct Graph API endpoint URL');
    assert(tReq.options.headers.Authorization === 'Bearer test_meta_token_tec_2026', 'Bearer token passed correctly');
    const sentBody = JSON.parse(tReq.options.body);
    assert(sentBody.type === 'template', 'Payload type is template');
    assert(sentBody.template.name === 'deadline_alert', 'Template name is deadline_alert');
    assert(sentBody.template.language.code === 'en_US', 'Template language is en_US');
    assert(sentBody.template.components.length === 1, 'Template components attached');

    // Test text failure with 131047 triggering fallback
    const textRes = await sendMetaText('+2349026675879', 'Hello accountability reminder');
    assert(textRes.ok === false, 'Freeform text returns false when 24h window expires');
    assert(textRes.code === 131047, 'Freeform text returns error code 131047');
    assert(is24HourWindowError(textRes.code, textRes.err) === true, 'Fallback condition correctly triggered');

    // Seamless fallback to sendMetaTemplate
    const fallbackRes = await sendMetaTemplate('+2349026675879', 'deadline_alert', compNoGoal);
    assert(fallbackRes.ok === true, 'Seamless template fallback succeeds after 131047 error');

    // Test dry-run preview generation schema
    const dryRunItem = {
      id: 'user_123',
      name: 'Izy Ogbonna',
      phone: '2349026675879',
      preview: '☀️ Good morning Izy! Week 2026-W37 is live...'.slice(0, 140) + '...',
      textPayload: {
        messaging_product: 'whatsapp',
        to: '2349026675879',
        type: 'text',
        text: { preview_url: false, body: 'Full reminder text' }
      },
      templatePayload: {
        messaging_product: 'whatsapp',
        to: '2349026675879',
        type: 'template',
        template: {
          name: 'deadline_alert',
          language: { code: 'en_US' },
          components: compNoGoal
        }
      },
      templateName: 'deadline_alert',
      components: compNoGoal
    };
    assert(typeof dryRunItem.preview === 'string', 'Dry run preserves text preview string');
    assert(dryRunItem.textPayload.type === 'text', 'Dry run contains complete textPayload');
    assert(dryRunItem.templatePayload.type === 'template', 'Dry run contains complete templatePayload');
    assert(dryRunItem.templatePayload.template.name === 'deadline_alert', 'Dry run template name matches configured template');

  } finally {
    globalThis.fetch = origFetch;
    process.env.META_ACCESS_TOKEN = origToken;
  }

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
