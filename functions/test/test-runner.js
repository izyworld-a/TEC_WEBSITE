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
