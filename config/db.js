// ============================================================================
// DATABASE CONNECTION — MongoDB via Mongoose
// ============================================================================
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.DATABASE_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('[db] DATABASE_URI is not set in environment variables.');
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