import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const ALLOWED_DIRS = ['lab', 'radiology', 'prescriptions', 'general'];

for (const dir of ALLOWED_DIRS) {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const category = (req.query.category as string) || 'general';
    const dir = ALLOWED_DIRS.includes(category) ? category : 'general';
    cb(null, path.join(UPLOAD_DIR, dir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/dicom',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الأنواع المسموح بها: PDF, JPEG, PNG, DICOM'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Build public URL for stored file
export const buildFileUrl = (req: Request, filePath: string): string => {
  const category = (req.query.category as string) || 'general';
  const filename = path.basename(filePath);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${category}/${filename}`;
};
