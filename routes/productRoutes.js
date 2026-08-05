const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { requireAuth } = require('../middleware/auth');
const { productUpload } = require('../middleware/upload');

router.get('/', ctrl.listProducts);
router.post('/', requireAuth, productUpload.array('photos', 4), ctrl.createProduct);
router.delete('/:id', requireAuth, ctrl.deleteProduct);

module.exports = router;
