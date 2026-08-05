// ============================================================================
// AUTH CONTROLLER (Phase 4 + email verification + password reset) — signup,
// login, "who am I", email verification, and password reset. Controllers
// decide *what happens*; token generation/hashing is delegated to
// utils/tokens.js (one implementation, shared by both flows below).
// ============================================================================
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { generateRawToken, hashToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;              // 1 hour — shorter-lived than email verification, deliberately

/** Generates a fresh verification token for a user, saves its hash, and emails the raw token. */
async function issueVerificationEmail(user) {
  const rawToken = generateRawToken();
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  await user.save();
  try { await sendVerificationEmail(user, rawToken); }
  catch (err) {
    // Signup itself should never fail just because the email provider hiccuped —
    // the user can always hit "resend verification email" from the app.
    console.error('[auth] failed to send verification email:', err.message);
  }
}

const signup = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with that email already exists.');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase(), phone, passwordHash });
  await issueVerificationEmail(user);

  res.status(201).json({ token: generateToken(user), user: toPublicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    throw new ApiError(401, 'Email or password not recognised.');
  }
  if (user.banned) throw new ApiError(403, 'This account has been suspended.');
  res.json({ token: generateToken(user), user: toPublicUser(user) });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

/**
 * The link a user clicks from their inbox — a direct browser navigation,
 * not an API call from the frontend, so this returns a small standalone
 * HTML page rather than JSON.
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const tokenHash = hashToken(req.params.token);
  const user = await User.findOne({ emailVerificationTokenHash: tokenHash, emailVerificationExpires: { $gt: new Date() } });

  if (!user) return res.status(400).send(infoPage(false, 'Link expired or invalid', 'Please request a new verification email from the app.'));
  user.verified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();
  res.send(infoPage(true, 'Email verified ✓', 'Your MsikaX account is now verified.'));
});

/** Lets a logged-in user request a new link, e.g. if the first one expired or landed in spam. */
const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.verified) return res.json({ ok: true, alreadyVerified: true });
  await issueVerificationEmail(req.user);
  res.json({ ok: true });
});

/**
 * Deliberately responds identically whether or not the email exists — an
 * attacker probing "which emails have accounts" learns nothing from the
 * response either way.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (user) {
    const rawToken = generateRawToken();
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();
    try { await sendPasswordResetEmail(user, rawToken); }
    catch (err) { console.error('[auth] failed to send password reset email:', err.message); }
  }
  res.json({ ok: true, message: "If that email has an account, we've sent a reset link." });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');

  const tokenHash = hashToken(req.params.token);
  const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This reset link has expired or is invalid — request a new one.');

  user.passwordHash = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidates every JWT issued before this reset — see middleware/auth.js
  await user.save();

  res.json({ token: generateToken(user), user: toPublicUser(user) }); // logs them straight in on their new password, on a fresh valid token
});

function toPublicUser(user) {
  const { passwordHash, emailVerificationTokenHash, emailVerificationExpires, passwordResetTokenHash, passwordResetExpires, __v, ...rest } = user.toObject();
  return rest;
}

function infoPage(success, heading, body) {
  const frontend = process.env.FRONTEND_ORIGIN || '#';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MsikaX</title>
  <style>body{font-family:sans-serif;background:#0F1117;color:#F1EEE4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
  .card{text-align:center;padding:40px;background:#1B1F2B;border-radius:16px;max-width:360px;}
  a{color:#1A1300;background:#F2A93B;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-top:16px;}</style>
  </head><body><div class="card">
  <h2>${heading}</h2><p>${body}</p><a href="${frontend}">Back to MsikaX</a>
  </div></body></html>`;
}

module.exports = { signup, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword };
