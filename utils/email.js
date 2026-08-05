// ============================================================================
// EMAIL UTILITY — sends account-verification and password-reset emails via
// any SMTP provider (Gmail with an app password works fine for free). If
// SMTP_* isn't set in .env yet, this logs the link to the console instead
// of throwing — so signup/reset still work during local development before
// you've configured a real mailbox, and you can still click the link
// straight out of the terminal.
// ============================================================================
const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

/** Shared send-or-log-to-console step, used by both email types below. */
async function deliverOrLog({ to, subject, text, html, devLabel }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n[email] SMTP not configured — ${devLabel} (dev mode):`);
    console.log(`[email] ${text}\n`);
    return { sent: false };
  }
  await transporter.sendMail({ from: process.env.EMAIL_FROM || 'MsikaX <no-reply@msikax.local>', to, subject, text, html });
  return { sent: true };
}

function buttonHtml(url, label) {
  return `<p><a href="${url}" style="background:#F2A93B;color:#1A1300;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${label}</a></p>`;
}

async function sendVerificationEmail(user, rawToken) {
  const backendOrigin = process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 4000}`;
  const verifyUrl = `${backendOrigin}/api/auth/verify-email/${rawToken}`;
  return deliverOrLog({
    to: user.email,
    subject: 'Verify your MsikaX account',
    text: `Hi ${user.name}, confirm your email here: ${verifyUrl} (expires in 24 hours)`,
    html: `<p>Hi ${user.name},</p><p>Confirm your email to finish setting up your MsikaX account:</p>${buttonHtml(verifyUrl, 'Verify my email')}<p style="color:#888;font-size:13px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    devLabel: 'verification link'
  });
}

/**
 * Unlike the verify-email link (a single confirming click), resetting a
 * password needs an actual form — so this points at the frontend, not the
 * backend. client/js/auth.js checks for ?resetToken= on load and opens the
 * reset-password modal automatically.
 */
async function sendPasswordResetEmail(user, rawToken) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5500';
  const resetUrl = `${frontendOrigin}/?resetToken=${rawToken}`;
  return deliverOrLog({
    to: user.email,
    subject: 'Reset your MsikaX password',
    text: `Hi ${user.name}, reset your password here: ${resetUrl} (expires in 1 hour). If you didn't request this, you can ignore this email — your password won't change.`,
    html: `<p>Hi ${user.name},</p><p>Reset your MsikaX password:</p>${buttonHtml(resetUrl, 'Reset my password')}<p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.</p>`,
    devLabel: 'password reset link'
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
