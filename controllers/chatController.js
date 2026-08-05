// ============================================================================
// CHAT CONTROLLER (Phase 11.5) — buyer <-> seller messaging. A buyer can
// only start a conversation by visiting a shop or product page (the
// frontend only ever calls startConversation with a shopId it got from
// rendering one of those pages); every conversation belongs to exactly one
// shop.
// ============================================================================
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Shop = require('../models/Shop');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

/** Buyer view: every conversation I'm part of. */
const myConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ buyer: req.user._id }).populate('shop', 'shopName emoji').sort({ lastMessageAt: -1 }).lean();
  res.json({ conversations });
});

/** Seller view: every conversation buyers have started with my shop. */
const shopConversations = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  const conversations = await Conversation.find({ shop: shop._id }).populate('buyer', 'name').sort({ lastMessageAt: -1 }).lean();
  res.json({ conversations });
});

/** Starts (or reuses) a conversation with a shop, optionally about a product. */
const startConversation = asyncHandler(async (req, res) => {
  const { shopId, productId } = req.body;
  const shop = await Shop.findById(shopId);
  if (!shop) throw new ApiError(404, 'Shop not found.');
  if (shop.owner.toString() === req.user._id.toString()) throw new ApiError(400, "You can't message your own shop.");

  const conversation = await Conversation.findOneAndUpdate(
    { buyer: req.user._id, shop: shopId },
    { $setOnInsert: { product: productId || null } },
    { upsert: true, new: true }
  );
  res.status(201).json({ conversation });
});

const getMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  await assertParticipant(conversation, req.user);
  const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 }).lean();
  res.json({ conversation, messages });
});

const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  await assertParticipant(conversation, req.user);
  const { text } = req.body;
  if (!text || !text.trim()) throw new ApiError(400, 'Message cannot be empty.');

  const message = await Message.create({ conversation: conversation._id, sender: req.user._id, text: text.trim() });
  conversation.lastMessage = text.trim();
  conversation.lastMessageAt = new Date();
  await conversation.save();
  res.status(201).json({ message });
});

async function assertParticipant(conversation, user) {
  if (conversation.buyer.toString() === user._id.toString()) return;
  const shop = await Shop.findById(conversation.shop);
  if (shop && shop.owner.toString() === user._id.toString()) return;
  throw new ApiError(403, "You're not part of this conversation.");
}

module.exports = { myConversations, shopConversations, startConversation, getMessages, sendMessage };
