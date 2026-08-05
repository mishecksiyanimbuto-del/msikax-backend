// Routes ONLY receive requests and hand off to a controller — no logic here.
const router = require('express').Router();
const { signup, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/signup', authLimiter, validate({ name: 'string', email: 'email', password: 'string' }), signup);
router.post('/login', authLimiter, validate({ email: 'email', password: 'string' }), login);
router.get('/me', requireAuth, me);
router.get('/verify-email/:token', verifyEmail);       // clicked directly from the email — returns HTML, not JSON
router.post('/resend-verification', requireAuth, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);

module.exports = router;
