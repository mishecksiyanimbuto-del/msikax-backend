// ============================================================================
// RATE LIMITING — nothing in this app was protected against being hammered:
// login/signup could be brute-forced, the (unauthenticated) suggestion box
// could be spammed. Three tiers:
//   generalLimiter    — a sane ceiling on the whole API
//   authLimiter       — much stricter, on login/signup specifically
//   suggestionLimiter — stops the open feedback box from being spammed
// ============================================================================
const rateLimit = require('express-rate-limit');

function make(windowMs, max, message) {
  return rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    message: { error: message }
  });
}

const generalLimiter = make(15 * 60 * 1000, 300, 'Too many requests — please slow down and try again shortly.');
const authLimiter = make(15 * 60 * 1000, 20, 'Too many login/signup attempts — please wait a few minutes and try again.');
const suggestionLimiter = make(60 * 60 * 1000, 10, 'Too many suggestions from this connection — please try again later.');

module.exports = { generalLimiter, authLimiter, suggestionLimiter };
