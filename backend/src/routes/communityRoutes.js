import { Router } from 'express';
import * as communityController from '../controllers/communityController.js';
import { authMiddleware, requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Apply authMiddleware to extract req.user on all community endpoints
router.use(authMiddleware);

// ─── Posts ───────────────────────────────────────────────────────────────────
router.get('/posts', communityController.listPosts);
router.post('/posts', requireAuth, communityController.createPost);
router.post('/posts/:id/like', requireAuth, communityController.toggleLike);
router.post('/posts/:id/save', requireAuth, communityController.toggleSave);
router.delete('/posts/:id', requireAuth, communityController.deletePost);

// ─── Comments ────────────────────────────────────────────────────────────────
router.get('/posts/:id/comments', communityController.getComments);
router.post('/posts/:id/comments', requireAuth, communityController.addComment);
router.post('/posts/:id/comments/:commentId/like', requireAuth, communityController.toggleCommentLike);
router.delete('/posts/:id/comments/:commentId', requireAuth, communityController.deleteComment);

// ─── Stories ─────────────────────────────────────────────────────────────────
router.get('/stories', communityController.getStories);
router.post('/stories', requireAuth, communityController.addStory);

// ─── Trekkers Directory & Profiles ───────────────────────────────────────────
router.get('/trekkers', communityController.listTrekkers);
router.get('/trekkers/:identifier', communityController.getTrekkerProfile);
router.post('/trekkers/:id/follow', requireAuth, communityController.toggleFollow);

// ─── Messaging ───────────────────────────────────────────────────────────────
router.get('/messages/unread-count', requireAuth, communityController.getUnreadMessagesCount);
router.get('/messages/conversations', requireAuth, communityController.getConversations);
router.post('/messages/conversations/direct', requireAuth, communityController.getOrCreateDirectConversation);
router.get('/messages/conversations/:id', requireAuth, communityController.getConversation);
router.post('/messages/conversations/:id/messages', requireAuth, communityController.sendMessage);
router.post('/messages/conversations/:id/read', requireAuth, communityController.markConversationRead);
router.delete('/messages/conversations/:id/messages/:messageId', requireAuth, communityController.deleteMessage);
router.delete('/messages/conversations/:id', requireAuth, communityController.deleteConversationForMe);
router.post('/messages/conversations/:id/request', requireAuth, communityController.handleMessageRequest);

// ─── Notifications ───────────────────────────────────────────────────────────
router.get('/notifications', requireAuth, communityController.getNotifications);
router.post('/notifications/read', requireAuth, communityController.markNotificationsRead);

// ─── Search ──────────────────────────────────────────────────────────────────
router.get('/search', communityController.searchCommunity);

// ─── User Search (searches real registered DB users) ─────────────────────────
// GET /api/community/users/search?q=rahul&location=all&experience=all&limit=20
router.get('/users/search', communityController.searchUsers);

export default router;
