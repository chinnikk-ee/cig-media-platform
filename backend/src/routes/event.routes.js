const router = require('express').Router();
const { createEvent, getEvents, getEvent, updateEvent, deleteEvent, getEventMedia } = require('../controllers/event.controller');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth.middleware');

router.get('/', optionalAuth, getEvents);
router.post('/', authenticate, authorize('admin'), createEvent);          // admin only
router.get('/:id', optionalAuth, getEvent);
router.put('/:id', authenticate, authorize('admin'), updateEvent);        // admin only
router.delete('/:id', authenticate, authorize('admin'), deleteEvent);     // admin only
router.get('/:id/media', optionalAuth, getEventMedia);

module.exports = router;
