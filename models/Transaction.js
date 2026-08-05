// ============================================================================
// TRANSACTION MODEL — an append-only log of every money movement (charges
// AND payouts). This is the seed of the financial ledger from Phase 9:
// balances should always be derived by summing transactions, never edited
// directly.
// ============================================================================
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  provider: { type: String, default: 'paychangu' },
  type: { type: String, enum: ['charge', 'payout', 'refund'], required: true },
  reference: { type: String, required: true }, // PayChangu charge_id/tx_ref
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  raw: mongoose.Schema.Types.Mixed // whatever PayChangu returned, for debugging
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
