const router = require('express').Router();
const {
  requestRole, getMyRequest, getPendingRequests, reviewRequest,
  getAllUsers, updateUserRole, assignPhotographer, removePhotographer, getEventPhotographers
} = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Viewer requests a role upgrade
router.post('/request-role', authenticate, requestRole);
router.get('/my-request', authenticate, getMyRequest);

// Admin only routes
router.get('/requests', authenticate, authorize('admin'), getPendingRequests);
router.post('/requests/:id/review', authenticate, authorize('admin'), reviewRequest);
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.put('/users/:id/role', authenticate, authorize('admin'), updateUserRole);
router.post('/assign-photographer', authenticate, authorize('admin'), assignPhotographer);
router.delete('/remove-photographer', authenticate, authorize('admin'), removePhotographer);
router.get('/event-photographers/:event_id', authenticate, authorize('admin'), getEventPhotographers);

module.exports = router;
