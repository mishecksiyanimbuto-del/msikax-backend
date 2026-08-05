// ============================================================================
// WALLET CONTROLLER (Phase 8/9) — a seller's private view of their money:
// current balance, the ledger of how it got there, and the ability to
// withdraw. Nothing here is ever reachable by a buyer or another seller —
// every handler resolves the shop from req.user, never from the URL.
// ============================================================================
const Shop = require('../models/Shop');
const wallet = require('../services/walletService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

async function myShopOrThrow(req) {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new ApiError(400, 'Open a shop first.');
  return shop;
}

const getWallet = asyncHandler(async (req, res) => {
  const shop = await myShopOrThrow(req);
  const [balance, recentEntries] = await Promise.all([
    wallet.getBalance(shop._id),
    wallet.getLedger(shop._id, { limit: 10 })
  ]);
  res.json({ balance, recentEntries, payoutOperator: shop.payoutOperator, payoutMobile: shop.payoutMobile });
});

const getLedger = asyncHandler(async (req, res) => {
  const shop = await myShopOrThrow(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 20;
  const entries = await wallet.getLedger(shop._id, { limit, skip: (page - 1) * limit });
  res.json({ entries, page });
});

const withdraw = asyncHandler(async (req, res) => {
  if (!req.user.verified) {
    throw new ApiError(403, 'Verify your email before withdrawing — check your inbox, or resend the link from your account.');
  }
  const shop = await myShopOrThrow(req);
  const amount = Number(req.body.amount);
  const result = await wallet.requestWithdrawal(shop, amount);
  const balance = await wallet.getBalance(shop._id);
  res.status(201).json({ withdrawal: result, balance });
});

const listWithdrawals = asyncHandler(async (req, res) => {
  const shop = await myShopOrThrow(req);
  res.json({ withdrawals: await wallet.listWithdrawals(shop._id) });
});

module.exports = { getWallet, getLedger, withdraw, listWithdrawals };
