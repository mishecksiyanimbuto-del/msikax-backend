const router = require('express').Router();
const ctrl = require('../controllers/followController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.listFollowing);
router.post('/:shopId', ctrl.followShop);
router.delete('/:shopId', ctrl.unfollowShop);

module.exports = router;
