import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as profileController from '../controllers/profileController.js';

const router = Router();

// Protect all profile API routes
router.use(requireAuth);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);

router.get('/treks', profileController.getTreks);
router.get('/treks/:trekId/status', profileController.getTrekUserStatus);
router.post('/treks/:trekId/status', profileController.setTrekStatus);
router.post('/treks/:trekId/complete', profileController.completeTrek);
router.post('/treks/:trekId/uncomplete', profileController.uncompleteTrek);

router.get('/badges', profileController.getBadges);
router.get('/activity', profileController.getActivity);

router.get('/reviews', profileController.getReviews);
router.post('/reviews', profileController.createReview);

router.put('/preferences', profileController.updateSettings);
router.post('/avatar', profileController.uploadAvatar);
router.get('/checklist', profileController.getChecklist);
router.put('/checklist', profileController.saveChecklist);
router.delete('/account', profileController.deleteAccount);

export default router;
