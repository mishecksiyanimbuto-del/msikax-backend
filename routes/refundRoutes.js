const router = require('express').Router();
const ctrl = require('../controllers/refundController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/orders/:orderId', ctrl.requestRefund); // buyer requests a refund for one of their own orders
router.get('/mine', ctrl.myRefundRequests);           // buyer's own refund requests
router.get('/shop', ctrl.shopRefundRequests);         // seller's requests concerning their shop
router.post('/:id/respond', ctrl.respondToRefund);    // seller adds context (doesn't decide — admin does)

module.exports = router;
