const router = require('express').Router();
const ctrl = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/auth');

router.get('/product/:productId', ctrl.listProductReviews); // public
router.get('/shop/:shopId', ctrl.listShopReviews);           // public
router.get('/mine', requireAuth, ctrl.myReviewedItems);
router.post('/', requireAuth, ctrl.createReview);
router.post('/:id/reply', requireAuth, ctrl.replyToReview);

module.exports = router;
