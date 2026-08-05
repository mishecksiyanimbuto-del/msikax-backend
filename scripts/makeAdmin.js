// ============================================================================
// MAKE-ADMIN SCRIPT — promotes an existing account to role:'admin'.
//
// There is deliberately NO API endpoint that can do this. An HTTP route
// that grants admin rights is a standing privilege-escalation target no
// matter how it's protected; requiring direct server/database access
// instead means only whoever can already reach your server can create an
// admin — which is the right bar for "who can see everyone's data."
//
// Usage (from the server/ folder, with .env already set up):
//   node scripts/makeAdmin.js someone@example.com
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/makeAdmin.js someone@example.com');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role: 'admin' },
    { new: true }
  );
  if (!user) {
    console.error(`No account found for ${email} — they need to sign up first.`);
  } else {
    console.log(`${user.name} <${user.email}> is now an admin.`);
  }
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
