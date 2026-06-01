const router = require('express').Router();
const { toggleLike, addComment, deleteComment, toggleFavourite, getMyFavourites, tagUser, shareMedia } = require('../controllers/social.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { canInteract } = require('../middleware/rbac.middleware');

router.post('/like', authenticate, canInteract, toggleLike);
router.post('/comment', authenticate, canInteract, addComment);
router.delete('/comment/:id', authenticate, deleteComment);
router.post('/favourite', authenticate, canInteract, toggleFavourite);
router.get('/favourites', authenticate, getMyFavourites);
router.post('/tag', authenticate, canInteract, tagUser);
router.get('/share/:id', shareMedia);

module.exports = router;
