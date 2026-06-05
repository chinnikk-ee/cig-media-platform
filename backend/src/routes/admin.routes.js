const router = require('express').Router();
const {
  requestRole, getMyRequest, getPendingRequests, reviewRequest,
  getAllUsers, updateUserRole, addUser, deleteUser, assignPhotographer, removePhotographer,
  getEventPhotographers, getDashboardStats, getPublicStats
} = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Public (no auth)
router.get('/public-stats', getPublicStats);

// Viewer requests a role upgrade
router.post('/request-role', authenticate, requestRole);
router.get('/my-request', authenticate, getMyRequest);

// Admin only routes
router.get('/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/requests', authenticate, authorize('admin'), getPendingRequests);
router.post('/requests/:id/review', authenticate, authorize('admin'), reviewRequest);
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.post('/users', authenticate, authorize('admin'), addUser);
router.put('/users/:id/role', authenticate, authorize('admin'), updateUserRole);
router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);
router.post('/assign-photographer', authenticate, authorize('admin'), assignPhotographer);
router.delete('/remove-photographer', authenticate, authorize('admin'), removePhotographer);
router.get('/event-photographers/:event_id', authenticate, authorize('admin'), getEventPhotographers);

module.exports = router;