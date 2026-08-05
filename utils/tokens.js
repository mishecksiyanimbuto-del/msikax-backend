// ============================================================================
// TOKEN UTILITY — the one place "generate a random token, store its hash,
// verify it later" lives. Email verification and password reset both need
// exactly this pattern; without this shared module they'd each grow their
// own slightly-different copy over time.
// ============================================================================
const crypto = require('crypto');

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateRawToken, hashToken };
