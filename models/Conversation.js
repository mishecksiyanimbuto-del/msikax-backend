// ============================================================================
// CONVERSATION MODEL — Phase 11.5 (chat). One conversation per buyer+shop
// pair (optionally tied to the product the buyer was viewing when they
// started it). A buyer can only start one by visiting a shop or product
// page — enforced in controllers/chatController.js, not here.
// ============================================================================
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

conversationSchema.index({ buyer: 1, shop: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
