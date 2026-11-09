/**
 * TrekIndia — Emergency SOS Intelligence API Routes
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as sosController from '../controllers/sosController.js';
import { authMiddleware, requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// High priority rate limiter (generous to never throttle real emergencies)
const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: 'Too many SOS requests. Please dial 112 directly for immediate emergency services.'
  }
});

// Incidents
router.post('/incidents', sosLimiter, authMiddleware, sosController.reportIncident);
router.get('/incidents/:id', authMiddleware, sosController.getIncident);

// Trusted Contacts
router.get('/contacts', requireAuth, sosController.getContacts);
router.post('/contacts', requireAuth, sosController.addContact);
router.delete('/contacts/:id', requireAuth, sosController.deleteContact);

export default router;

