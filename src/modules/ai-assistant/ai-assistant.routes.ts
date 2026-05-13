import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  chat, doctorChat, adminChat, getChatHistory, getMySessions,
  doctorPatientSummaryAI, draftVisitSummary,
  adminOperationalSummary,
} from './ai-assistant.controller';

const router = Router();
router.use(authenticate);

// ─── Patient ───
router.post('/chat', authorize('PATIENT'), chat);
router.get('/sessions', authorize('PATIENT'), getMySessions);
router.get('/sessions/:sessionId', authorize('PATIENT'), getChatHistory);

// ─── Doctor ───
router.post('/doctor/chat', authorize('DOCTOR'), doctorChat);
router.get('/doctor/patient/:patientId/summary', authorize('DOCTOR'), doctorPatientSummaryAI);
router.post('/doctor/patient/:patientId/draft-visit', authorize('DOCTOR'), draftVisitSummary);

// ─── Admin ───
router.post('/admin/chat', authorize('ADMIN'), adminChat);
router.get('/admin/operational-summary', authorize('ADMIN'), adminOperationalSummary);

export default router;
