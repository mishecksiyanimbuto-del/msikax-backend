// ============================================================================
// ORDER MODEL — created the moment checkout starts (status "pending"), and
// only ever moved forward by the server (webhook or status poll) — never by
// anything the browser sends. shopBreakdown is where the automatic 9%
// commission split per-shop is recorded (Phase 6 / Phase 10: never trust
// the frontend for money math). Once paid, each row's seller share is
// credited to that shop's wallet (Phase 8) — see services/walletService.js —
// rather than paid out instantly; the seller withdraws from their wallet
// whenever they choose.
// ============================================================================
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String, price: Number, qty: Number, emoji: String
}, { _id: false });

const shopBreakdownSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  subtotal: Number,
  commission: Number,      // MsikaX's 9%
  sellerEarnings: Number,  // the seller's 91% — lands in their wallet, not paid out instantly (Phase 8)
  walletCredited: { type: Boolean, default: false },
  walletCreditedAt: Date
}, { _id: false });

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  commission: { type: Number, required: true },   // total 9% across the whole order
  deliveryFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  shopBreakdown: [shopBreakdownSchema],
  chargeId: { type: String, required: true, unique: true }, // PayChangu tx_ref / charge_id
  method: { type: String, enum: ['airtel', 'mpamba', 'mo626', 'paychangu'], required: true },
  phone: String,
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  orderStatus: {
    type: String,
    enum: ['pending', 'awaiting_payment', 'paid', 'preparing', 'ready', 'collected', 'delivered', 'completed', 'cancelled', 'refunded', 'returned'],
    default: 'awaiting_payment'
  },
  // Populated only if stock ran out for an item between charge and payment
  // confirmation (two buyers paying for the last unit at nearly the same
  // moment) — the atomic guard in fulfillOrder() stops stock from ever
  // going negative, but the paid order still needs a human to follow up
  // with that buyer (refund or restock) since no refund automation exists yet.
  stockConflicts: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, qty: Number, _id: false }]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
