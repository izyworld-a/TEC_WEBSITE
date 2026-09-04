require('dotenv').config();
const express = require('express');
const { handleWhatsAppWebhook } = require('./index');

const app = express();
const PORT = process.env.PORT || 5000;

// Capture raw body for Meta X-Hub-Signature-256 HMAC validation
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'TEC Weekly Meta WhatsApp Webhook & AI Service',
    endpoint: '/whatsappWebhook'
  });
});

// Diagnostic endpoint to verify environment keys and test Gemini execution live
app.get('/diag', async (req, res) => {
  const { generateFacilitatorResponse } = require('./services/geminiEngine');
  let geminiTest = null;
  let geminiError = null;
  try {
    geminiTest = await generateFacilitatorResponse({
      userId: '+2348164771958',
      incomingMessage: 'Testing milestone update',
      hasImage: false
    });
  } catch (err) {
    geminiError = err?.response?.data || err.message;
  }

  res.json({
    env: {
      hasMetaToken: !!process.env.META_ACCESS_TOKEN,
      metaTokenPrefix: (process.env.META_ACCESS_TOKEN || '').slice(0, 10),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      geminiKeyPrefix: (process.env.GEMINI_API_KEY || '').slice(0, 8),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      phoneNumberId: process.env.PHONE_NUMBER_ID
    },
    geminiResult: geminiTest,
    geminiError
  });
});

// Meta Webhook endpoint (handles GET verification handshake and POST incoming messages)
app.all('/whatsappWebhook', async (req, res) => {
  try {
    await handleWhatsAppWebhook(req, res);
  } catch (err) {
    console.error('[Server] Unhandled webhook error:', err);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`TEC Weekly Webhook server is running on port ${PORT}`);
  console.log(`Local Webhook URL: http://localhost:${PORT}/whatsappWebhook`);
  console.log('====================================================');
});
