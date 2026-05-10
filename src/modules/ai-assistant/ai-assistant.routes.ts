import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  chat, getChatHistory, getMySessions,
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
router.get('/doctor/patient/:patientId/summary', authorize('DOCTOR'), doctorPatientSummaryAI);
router.post('/doctor/patient/:patientId/draft-visit', authorize('DOCTOR'), draftVisitSummary);

// ─── Admin ───
router.get('/admin/operational-summary', authorize('ADMIN'), adminOperationalSummary);

export default router;
