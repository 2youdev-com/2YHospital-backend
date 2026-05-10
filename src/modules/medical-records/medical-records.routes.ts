import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getLabResults, getLabResult, getRadiologyReports, getRadiologyReport,
  getPrescriptions, getVisitHistory,
  getPatientSummary, addMedicalNote, approveMedicalNote,
} from './medical-records.controller';
import { uploadLabReport, uploadRadiologyFile, uploadMedicalDocument } from './upload.controller';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const router = Router();
router.use(authenticate);

// ─── Patient ───
router.get('/lab-results', authorize('PATIENT'), getLabResults);
router.get('/lab-results/:id', authorize('PATIENT'), getLabResult);
router.get('/radiology', authorize('PATIENT'), getRadiologyReports);
router.get('/radiology/:id', authorize('PATIENT'), getRadiologyReport);
router.get('/prescriptions', authorize('PATIENT'), getPrescriptions);
router.get('/visits', authorize('PATIENT'), getVisitHistory);

// ─── Doctor: upload reports ───
router.post(
  '/lab-results/:labResultId/upload',
  authorize('DOCTOR', 'ADMIN'),
  uploadMiddleware.single('file'),
  uploadLabReport
);
router.post(
  '/radiology/:reportId/upload',
  authorize('DOCTOR', 'ADMIN'),
  uploadMiddleware.single('file'),
  uploadRadiologyFile
);
router.post(
  '/upload',
  authorize('DOCTOR', 'ADMIN', 'PATIENT'),
  uploadMiddleware.single('file'),
  uploadMedicalDocument
);

// ─── Doctor ───
router.get('/patient/:patientId/summary', authorize('DOCTOR'), getPatientSummary);
router.post('/patient/:patientId/notes', authorize('DOCTOR'), addMedicalNote);
router.patch('/notes/:noteId/approve', authorize('DOCTOR'), approveMedicalNote);

export default router;
