const router = require('express').Router();
const { search } = require('../controllers/search.controller');
const { optionalAuth } = require('../middleware/auth.middleware');
router.get('/', optionalAuth, search);
module.exports = router;
