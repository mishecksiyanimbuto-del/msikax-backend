// ============================================================================
// SHOP MODEL — one shop per owner. Carries payout details (Phase 6/7/8) and
// the free-listing-quota / subscription state (business rules live in
// services/commissionService.js + services/listingQuotaService.js, not here).
// ============================================================================
const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  shopName: { type: String, required: true, trim: true },
  description: { type: String, default: 'Welcome to my shop on MsikaX.' },
  category: { type: String, default: 'Other' },
  district: { type: String, default: '' }, // Phase 15 search filter: Malawian district
  emoji: { type: String, default: '🛍️' },
  logo: { type: String, default: null }, // uploaded profile picture, e.g. /uploads/shops/xxx.jpg — falls back to emoji when not set
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }, // convenience flag, kept in sync with verification.status === 'verified'
  verification: {
    status: { type: String, enum: ['unsubmitted', 'pending', 'verified', 'rejected'], default: 'unsubmitted' },
    idDocument: { type: String, default: null },              // filename only — lives in private-uploads/, never a public URL
    businessDocument: { type: String, default: null },        // optional, e.g. business registration certificate
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: null }
  },
  suspended: { type: Boolean, default: false }, // admin moderation — hidden from the public marketplace while true
  payoutOperator: { type: String, enum: ['airtel', 'mpamba', null], default: null },
  payoutMobile: { type: String, default: null },
  // Atomic lock guarding withdrawals (see services/walletService.js) — a
  // single-document update in Mongo is always atomic, even without
  // replica-set transactions, so this is what actually stops two
  // concurrent withdrawal requests from both reading the same balance and
  // both going through.
  withdrawalLockedAt: { type: Date, default: null },
  subscription: {
    active: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);
