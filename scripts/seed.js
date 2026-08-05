// ============================================================================
// DATABASE SEED SCRIPT — populates demo accounts, shops, products, a paid
// order, a review, a follow relationship, and real wallet activity so the
// app isn't empty on first run. Run with: npm run seed (from /server) once
// MONGODB_URI is set in server/.env.
//
// Lives in server/scripts/ (alongside makeAdmin.js) rather than the
// project-level database/ folder — Node resolves each file's `require()`
// calls relative to that file's own location, and only server/ has
// node_modules installed (dotenv, mongoose, bcryptjs). A version of this
// script sitting directly in database/ would fail to find those packages,
// since that folder is a sibling of server/, not a descendant of it.
// database/seed.js is kept as a thin pointer to this file for anyone who
// runs it from there directly.
//
// Wherever possible this reuses the actual production code (e.g.
// walletService.creditOrderToWallet) rather than faking the end state
// directly — so the demo data is exactly what the real checkout flow would
// have produced, and stays correct automatically if that logic ever changes.
//
// The demo admin account created here is a LOCAL/DEV convenience only.
// Production admin promotion should always go through
// `node scripts/makeAdmin.js someone@example.com` against a real account —
// see that script's own comment for why this is deliberately not something
// the app exposes any other way.
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { buildShopBreakdown } = require('../services/commissionService');
const { creditOrderToWallet } = require('../services/walletService');
const { recomputeShopRating } = require('../services/reviewService');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[seed] connected');

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const chisomo = await User.findOneAndUpdate(
    { email: 'chisomo@demo.mw' },
    { name: 'Chisomo Banda', email: 'chisomo@demo.mw', phone: '+265991234567', passwordHash, verified: true },
    { upsert: true, new: true }
  );
  const tadala = await User.findOneAndUpdate(
    { email: 'tadala@demo.mw' },
    { name: 'Tadala Phiri', email: 'tadala@demo.mw', phone: '+265881234567', passwordHash, verified: true },
    { upsert: true, new: true }
  );
  // A pure buyer account (no shop) — handy for testing buyer-only flows
  // (reviews, refunds, wishlist) without switching out of a seller account.
  const grace = await User.findOneAndUpdate(
    { email: 'grace@demo.mw' },
    { name: 'Grace Mvula', email: 'grace@demo.mw', phone: '+265991112222', passwordHash, verified: true },
    { upsert: true, new: true }
  );
  // Local-dev admin — see the file header comment above.
  const admin = await User.findOneAndUpdate(
    { email: 'admin@demo.mw' },
    { name: 'MsikaX Admin', email: 'admin@demo.mw', phone: '+265990000000', passwordHash, verified: true, role: 'admin' },
    { upsert: true, new: true }
  );

  const shop1 = await Shop.findOneAndUpdate(
    { owner: chisomo._id },
    {
      owner: chisomo._id, shopName: 'Chisomo Fashion House', description: 'Chitenje wear, shoes & accessories made in Lilongwe.',
      category: 'Fashion', district: 'Lilongwe', emoji: '👗', payoutOperator: 'airtel', payoutMobile: chisomo.phone,
      verified: true, verification: { status: 'verified', reviewedAt: new Date(), reviewedBy: admin._id } // pre-approved for the demo
    },
    { upsert: true, new: true }
  );
  const shop2 = await Shop.findOneAndUpdate(
    { owner: tadala._id },
    { owner: tadala._id, shopName: 'Tadala Tech Corner', description: 'Phones, chargers and accessories at fair prices.', category: 'Electronics', district: 'Blantyre', emoji: '📱', payoutOperator: 'mpamba', payoutMobile: tadala.phone },
    { upsert: true, new: true }
  );

  let products = await Product.find({ seller: { $in: [shop1._id, shop2._id] } });
  if (products.length === 0) {
    products = await Product.insertMany([
      { seller: shop1._id, title: 'Chitenje Wrap Dress', price: 18500, description: 'Handmade wrap dress, one size fits most.', category: 'Fashion', emoji: '👗', stock: 12 },
      { seller: shop1._id, title: 'Leather Sandals', price: 9500, description: 'Genuine leather, sizes 38-44.', category: 'Fashion', emoji: '🥾', stock: 20 },
      { seller: shop2._id, title: 'Fast Charger 20W', price: 12000, description: 'USB-C fast charger, original box.', category: 'Electronics', emoji: '🔌', stock: 30 },
      { seller: shop2._id, title: 'Refurbished Smartphone', price: 145000, description: '6.5" screen, 64GB, 3 month warranty.', category: 'Electronics', emoji: '📱', stock: 5 }
    ]);
    console.log('[seed] products created');
  } else {
    console.log('[seed] products already exist, skipping');
  }
  const dress = products.find(p => p.title === 'Chitenje Wrap Dress');

  // A completed purchase: Grace bought the dress from Chisomo's shop, paid,
  // left a review, and Chisomo replied — demonstrates the wallet, ledger,
  // and reviews features with real, consistent data on first run.
  const existingDemoOrder = await Order.findOne({ chargeId: 'MX-SEED-DEMO-ORDER' });
  if (!existingDemoOrder && dress) {
    const items = [{ product: dress._id, name: dress.title, price: dress.price, qty: 1, emoji: dress.emoji, shopId: shop1._id }];
    const shopBreakdown = buildShopBreakdown(items);
    const order = await Order.create({
      buyer: grace._id, items, subtotal: dress.price, commission: shopBreakdown[0].commission, total: dress.price,
      shopBreakdown, chargeId: 'MX-SEED-DEMO-ORDER', method: 'airtel', phone: grace.phone,
      paymentStatus: 'paid', orderStatus: 'paid'
    });
    await creditOrderToWallet(order); // the real production code path — credits Chisomo's wallet + writes the ledger entries

    const review = await Review.create({
      order: order._id, product: dress._id, shop: shop1._id, buyer: grace._id,
      rating: 5, comment: 'Beautiful dress, exactly as pictured — fast to arrange pickup too.',
      sellerReply: 'Thank you so much, Grace! 💛', sellerRepliedAt: new Date()
    });
    await recomputeShopRating(shop1._id); // same function the real review endpoint calls

    await User.findByIdAndUpdate(grace._id, { $addToSet: { following: shop1._id } });
    console.log('[seed] demo order, wallet credit, review, and follow relationship created');
  } else {
    console.log('[seed] demo order already exists, skipping');
  }

  console.log('\n[seed] done. Demo logins (all use password: demo1234):');
  console.log('  Seller (verified shop) — chisomo@demo.mw');
  console.log('  Seller                 — tadala@demo.mw');
  console.log('  Buyer                  — grace@demo.mw');
  console.log('  Admin                  — admin@demo.mw');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
