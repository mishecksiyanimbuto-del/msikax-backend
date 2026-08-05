// ============================================================================
// WITHDRAWAL MODEL (Phase 8) — a seller's request to move money OUT of
// their MsikaX wallet and into their own Airtel Money / TNM Mpamba account.
// This is the only path money ever leaves a wallet (besides refunds), which
// is what makes the wallet model safer than paying sellers instantly on
// every sale: a dispute or refund can be resolved before the money has
// actually left the platform.
// ============================================================================
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  amount: { type: Number, required: true },
  operator: { type: String, enum: ['airtel', 'mpamba'], required: true },
  mobile: { type: String, required: true },
  status: { type: String, enum: ['processing', 'paid', 'failed'], default: 'processing' },
  reference: { type: String, required: true, unique: true }, // charge_id sent to PayChangu's payout endpoint
  failureReason: { type: String, default: null },
  processedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
