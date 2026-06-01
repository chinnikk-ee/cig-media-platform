const router = require('express').Router();
const { uploadMedia, getMedia, deleteMedia, downloadMedia, uploadSelfie, getMyPhotos } = require('../controllers/media.controller');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { canUploadToEvent, canDeleteMedia } = require('../middleware/rbac.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/upload', authenticate, upload.array('files', 50), canUploadToEvent, uploadMedia);
router.get('/my-photos', authenticate, getMyPhotos);
router.post('/selfie', authenticate, upload.single('selfie'), uploadSelfie);
router.get('/:id', optionalAuth, getMedia);
router.delete('/:id', authenticate, canDeleteMedia, deleteMedia);
router.get('/:id/download', optionalAuth, downloadMedia);

module.exports = router;
