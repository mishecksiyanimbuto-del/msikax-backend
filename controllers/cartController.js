// ============================================================================
// CART CONTROLLER — a tiny embedded-array cart on the User document itself
// (see models/User cartItems... actually stored via a lightweight
// sub-collection query here to keep Product stock authoritative).
// Every quantity change is validated against live stock server-side.
// ============================================================================
const mongoose = require('mongoose');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

// Cart items live in their own tiny collection: {user, product, qty}.
const cartItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true, min: 1 }
}, { timestamps: true });
cartItemSchema.index({ user: 1, product: 1 }, { unique: true });
const CartItem = mongoose.models.CartItem || mongoose.model('CartItem', cartItemSchema);

async function hydrateCart(userId) {
  const rows = await CartItem.find({ user: userId }).populate({ path: 'product', populate: { path: 'seller', select: 'shopName' } }).lean();
  return rows.filter(r => r.product).map(r => ({
    productId: r.product._id, qty: r.qty,
    product: { ...r.product, shopName: r.product.seller?.shopName || 'MsikaX Shop' }
  }));
}

const getCart = asyncHandler(async (req, res) => res.json({ items: await hydrateCart(req.user._id) }));

const addToCart = asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Item not found.');
  const existing = await CartItem.findOne({ user: req.user._id, product: productId });
  const nextQty = (existing ? existing.qty : 0) + (Number(qty) || 1);
  if (nextQty > product.stock) throw new ApiError(400, `Only ${product.stock} left in stock.`);
  await CartItem.findOneAndUpdate({ user: req.user._id, product: productId }, { qty: nextQty }, { upsert: true });
  res.status(201).json({ items: await hydrateCart(req.user._id) });
});

const setCartQty = asyncHandler(async (req, res) => {
  const qty = Number(req.body.qty);
  if (qty <= 0) { await CartItem.deleteOne({ user: req.user._id, product: req.params.productId }); return res.json({ items: await hydrateCart(req.user._id) }); }
  const product = await Product.findById(req.params.productId);
  if (!product) throw new ApiError(404, 'Item not found.');
  if (qty > product.stock) throw new ApiError(400, `Only ${product.stock} left in stock.`);
  await CartItem.findOneAndUpdate({ user: req.user._id, product: req.params.productId }, { qty }, { upsert: true });
  res.json({ items: await hydrateCart(req.user._id) });
});

const removeFromCart = asyncHandler(async (req, res) => {
  await CartItem.deleteOne({ user: req.user._id, product: req.params.productId });
  res.json({ items: await hydrateCart(req.user._id) });
});

module.exports = { getCart, addToCart, setCartQty, removeFromCart, CartItem, hydrateCart };
