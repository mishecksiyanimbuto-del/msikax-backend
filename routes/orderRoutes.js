const router = require('express').Router();
const { myOrders } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, myOrders);

module.exports = router;
