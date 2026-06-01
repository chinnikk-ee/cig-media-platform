const router = require('express').Router();
const { getNotifications, markRead } = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
router.get('/', authenticate, getNotifications);
router.post('/mark-read', authenticate, markRead);
module.exports = router;
