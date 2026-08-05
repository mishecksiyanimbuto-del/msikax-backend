// ============================================================================
// USER MODEL — buyers and sellers are the same account type; a user becomes
// a "seller" simply by owning a Shop (see Shop.owner). role/verified exist
// for the admin panel and seller-verification phases coming later.
// ============================================================================
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  banned: { type: Boolean, default: false }, // admin moderation — a banned user can't log in (see authController)
  verified: { type: Boolean, default: false }, // true once the email link below has been clicked
  emailVerificationTokenHash: { type: String, default: null }, // SHA-256 of the token — never store the raw token
  emailVerificationExpires: { type: Date, default: null },
  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
  // Bumped on every password reset. Embedded in each JWT at sign time; if
  // it doesn't match the user's current value the token is treated as
  // expired — this is what "invalidate old login tokens" on a password
  // reset actually means for a stateless JWT (no server-side session
  // store to delete from otherwise).
  tokenVersion: { type: Number, default: 0 },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
