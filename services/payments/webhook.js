// ============================================================================
// WEBHOOK VERIFICATION — signature-checking lives here so
// controllers/webhookController.js stays focused on "what happens next"
// rather than the cryptography.
// ============================================================================
const paychangu = require('./paychangu');
module.exports = { verifyWebhookSignature: paychangu.verifyWebhookSignature };
