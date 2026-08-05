const router = require('express').Router();
const ctrl = require('../controllers/cartController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.getCart);
router.post('/', ctrl.addToCart);
router.patch('/:productId', ctrl.setCartQty);
router.delete('/:productId', ctrl.removeFromCart);

module.exports = router;
