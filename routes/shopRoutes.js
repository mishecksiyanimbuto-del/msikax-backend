const router = require('express').Router();
const ctrl = require('../controllers/shopController');
const verificationCtrl = require('../controllers/verificationController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { shopLogoUpload, verificationUpload } = require('../middleware/upload');

router.get('/', ctrl.listShops);
router.get('/mine', requireAuth, ctrl.myShop);
router.get('/mine/listing-status', requireAuth, ctrl.listingStatus);
router.patch('/mine/payout', requireAuth, ctrl.updatePayout);
router.patch('/mine/logo', requireAuth, shopLogoUpload.single('logo'), ctrl.updateLogo);
router.post('/mine/verification', requireAuth, verificationUpload.fields([{ name: 'idDocument', maxCount: 1 }, { name: 'businessDocument', maxCount: 1 }]), verificationCtrl.submitVerification);
router.get('/mine/verification/document/:type', requireAuth, verificationCtrl.getMyDocument);
router.get('/:id', ctrl.getShop);
router.post('/', requireAuth, shopLogoUpload.single('logo'), validate({ name: 'string' }), ctrl.createShop);

module.exports = router;
