// ============================================================================
// WEBHOOK CONTROLLER (Phase 6/7) — PayChangu's server-to-server payment
// confirmation. This is the ONLY place an order is trusted to be paid from
// the payment provider's side (the status-poll endpoint is just a fallback
// in case this never arrives).
// ============================================================================
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const Transaction = require('../models/Transaction');
const { verifyWebhookSignature } = require('../services/payments/webhook');
const { fulfillOrder } = require('./checkoutController');

async function handlePaychanguWebhook(req, res) {
  const signature = req.headers['signature'];
  const rawBody = req.body; // Buffer — mounted with express.raw() in app.js

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] rejected — signature did not match');
    return res.status(400).json({ error: 'invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'invalid json' }); }

  // Standard Checkout webhooks use tx_ref; direct charges use charge_id.
  // Both are set to our own chargeId, so either key resolves the order.
  const chargeId = event.charge_id || event.tx_ref;
  if (!chargeId) return res.sendStatus(200);

  if (event.status === 'success' || event.status === 'successful') {
    // Could be a checkout order OR a subscription charge (MXSUB- prefix) —
    // only orders need fulfillOrder(); subscriptions are activated by the
    // buyer's browser polling /subscribe/:chargeId/status instead, since
    // that path also needs to read the *shop*, not just the order.
    const order = await Order.findOne({ chargeId });
    if (order) await fulfillOrder(order);
  } else {
    await Order.findOneAndUpdate({ chargeId }, { paymentStatus: 'failed' });
    await Transaction.findOneAndUpdate({ reference: chargeId }, { status: 'failed' });
  }
  res.sendStatus(200); // acknowledge fast, or PayChangu will retry
}

module.exports = { handlePaychanguWebhook };
