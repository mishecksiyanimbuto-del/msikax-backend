const router = require('express').Router();
const ctrl = require('../controllers/checkoutController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, ctrl.startCheckout);
router.get('/:chargeId/status', requireAuth, ctrl.checkoutStatus);

module.exports = router;
