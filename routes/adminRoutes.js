const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const verificationCtrl = require('../controllers/verificationController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

router.get('/stats', ctrl.getStats);

router.get('/users', ctrl.listUsers);
router.patch('/users/:id/ban', ctrl.toggleUserBan);

router.get('/shops', ctrl.listShops);
router.patch('/shops/:id/suspend', ctrl.toggleShopSuspend);

router.get('/products', ctrl.listProducts);
router.delete('/products/:id', ctrl.removeProduct);

router.get('/orders', ctrl.listOrders);
router.get('/transactions', ctrl.listTransactions);
router.get('/withdrawals', ctrl.listWithdrawals);

router.get('/suggestions', ctrl.listSuggestions);
router.delete('/suggestions/:id', ctrl.dismissSuggestion);

router.get('/verifications', verificationCtrl.listVerifications);
router.get('/verifications/:shopId/document/:type', verificationCtrl.getDocumentForAdmin);
router.post('/verifications/:shopId/approve', verificationCtrl.approveVerification);
router.post('/verifications/:shopId/reject', verificationCtrl.rejectVerification);

router.get('/refunds', ctrl.listRefunds);
router.post('/refunds/:id/approve', ctrl.approveRefund);
router.post('/refunds/:id/reject', ctrl.rejectRefund);

module.exports = router;
