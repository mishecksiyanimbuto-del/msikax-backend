// ============================================================================
// AUTH MIDDLEWARE (Phase 4) — reads "Authorization: Bearer <token>", verifies
// the JWT, and attaches req.user. Nothing past this point in a protected
// route runs for a request that isn't carrying a valid session.
// ============================================================================
const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Log in to continue.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    if ((payload.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Your session is no longer valid — please log in again.' });
    }
    if (user.banned) return res.status(403).json({ error: 'This account has been suspended.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired — please log in again.' });
  }
}

/** Stacks after requireAuth — only an admin account may proceed. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
