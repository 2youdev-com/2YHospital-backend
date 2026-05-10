import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
  getProfile, updateProfile, getDependents, addDependent, removeDependent,
} from './patients.controller';
import { addAllergy, removeAllergy, updateChronicDiseases } from './allergies.controller';

const router = Router();
router.use(authenticate);

// Patient profile
router.get('/profile', authorize('PATIENT'), getProfile);
router.put('/profile', authorize('PATIENT'), updateProfile);

// Dependents
router.get('/dependents', authorize('PATIENT'), getDependents);
router.post('/dependents', authorize('PATIENT'), addDependent);
router.delete('/dependents/:id', authorize('PATIENT'), removeDependent);

// Allergies
router.post('/allergies', authorize('PATIENT'), addAllergy);
router.delete('/allergies/:allergy', authorize('PATIENT'), removeAllergy);

// Chronic diseases
router.put('/chronic-diseases', authorize('PATIENT'), updateChronicDiseases);

export default router;
