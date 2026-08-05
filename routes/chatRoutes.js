const router = require('express').Router();
const ctrl = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.myConversations);           // my conversations (as buyer)
router.get('/shop', ctrl.shopConversations);     // conversations with my shop (as seller)
router.post('/', ctrl.startConversation);        // start/reuse a conversation
router.get('/:id/messages', ctrl.getMessages);
router.post('/:id/messages', ctrl.sendMessage);

module.exports = router;
