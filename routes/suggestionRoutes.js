const router = require('express').Router();
const { createSuggestion } = require('../controllers/suggestionController');
const { suggestionLimiter } = require('../middleware/rateLimit');

router.post('/', suggestionLimiter, createSuggestion); // open to anyone, logged in or not

module.exports = router;
