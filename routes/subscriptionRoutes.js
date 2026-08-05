const router = require('express').Router();
const ctrl = require('../controllers/subscriptionController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, ctrl.startSubscription);
router.get('/:chargeId/status', requireAuth, ctrl.subscriptionStatus);

module.exports = router;
