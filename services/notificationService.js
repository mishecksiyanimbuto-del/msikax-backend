// ============================================================================
// NOTIFICATION SERVICE — one function, notify(), called from every place in
// the app that already knows something notification-worthy just happened
// (order paid, withdrawal resolved, verification decided, refund requested/
// resolved, stock hit zero). Nothing computes "should I notify" logic
// outside those existing code paths — this module just records it.
//
// Delivery is polling, not push: the client already polls for chat messages
// and payment status (see client/js/chat.js, checkout.js) — notifications
// reuse that same proven pattern rather than introducing Socket.IO for one
// feature. A real-time upgrade later would only need to change how the
// client learns about a new row here, not this module.
// ============================================================================
const Notification = require('../models/Notification');

async function notify(userId, type, title, body = '', refs = {}) {
  if (!userId) return null; // e.g. a shop with no owner (the seeded "Namiwa Fresh Produce" demo shop) — nothing to notify
  return Notification.create({ user: userId, type, title, body, ...refs });
}

module.exports = { notify };
