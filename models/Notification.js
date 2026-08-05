// ============================================================================
// NOTIFICATION MODEL — in-app notifications, polled by the client rather
// than pushed over a websocket (see services/notificationService.js for why:
// this app already polls for chat messages and payment status the same
// way, so notifications follow the same, already-proven pattern instead of
// introducing a new real-time transport just for this one feature).
// ============================================================================
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'order_paid', 'order_refunded',
      'new_order', 'withdrawal_paid', 'withdrawal_failed',
      'verification_approved', 'verification_rejected',
      'refund_requested', 'refund_resolved',
      'product_out_of_stock', 'new_review', 'shop_new_listing'
    ]
  },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  read: { type: Boolean, default: false },
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  relatedShop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
