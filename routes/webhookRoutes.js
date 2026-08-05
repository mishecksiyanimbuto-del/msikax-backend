const router = require('express').Router();
const { handlePaychanguWebhook } = require('../controllers/webhookController');

// NOTE: mounted with express.raw() at the app.js level, not express.json(),
// so the signature check sees the exact bytes PayChangu signed.
router.post('/paychangu', handlePaychanguWebhook);

module.exports = router;
