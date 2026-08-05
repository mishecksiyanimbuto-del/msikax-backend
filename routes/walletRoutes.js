const router = require('express').Router();
const ctrl = require('../controllers/walletController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.getWallet);                 // balance + recent ledger entries
router.get('/ledger', ctrl.getLedger);            // full paginated ledger
router.get('/withdrawals', ctrl.listWithdrawals); // withdrawal history
router.post('/withdraw', ctrl.withdraw);          // cash out to Airtel Money / TNM Mpamba

module.exports = router;
