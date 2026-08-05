// ============================================================================
// REFUND MODEL — the flow is:
//   Buyer requests -> Seller responds (context, not a decision) ->
//   Admin reviews -> approved: wallet debited + ledger updated, buyer repaid
//                     rejected: nothing moves, buyer told why
//
// A refund is requested against a whole ORDER, not a single shop — but an
// order's items can span multiple shops (see Order.shopBreakdown), so on
// approval every shop involved gets its own refund_adjustment ledger entry
// for its own share. See services/refundService.js.
// ============================================================================
const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['requested', 'seller_responded', 'approved', 'rejected'], default: 'requested' },
  sellerResponse: { type: String, default: null },
  sellerRespondedAt: { type: Date, default: null },
  adminNote: { type: String, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  // Per-shop outcome of actually moving the money back, filled in on approval —
  // see services/refundService.js. Mobile money repayment to the buyer is only
  // possible for airtel/mpamba-paid orders; mo626/paychangu orders are flagged
  // for manual handling since there's no automated reversal path for those rails.
  buyerRepayment: {
    status: { type: String, enum: ['not_attempted', 'paid', 'manual_required', 'failed'], default: 'not_attempted' },
    detail: { type: String, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('Refund', refundSchema);
