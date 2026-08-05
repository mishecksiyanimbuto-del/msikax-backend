// ============================================================================
// DATABASE CONNECTION — MongoDB via Mongoose (Phase 3).
// ============================================================================
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[db] MONGODB_URI is not set in .env — see README for a free MongoDB Atlas cluster.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('[db] Connected to MongoDB');
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
