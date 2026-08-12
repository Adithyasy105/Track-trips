// src/routes/placeRoutes.js
import express from 'express';
import multer from 'multer';
import { addPlace, getTripPlaces, updatePlace, deletePlace } from '../controllers/placeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = express.Router();

const supportedImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/avif'
];

const supportedImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif', 'avif'];

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const mimeType = (file.mimetype || '').toLowerCase();
    const fileName = (file.originalname || '').toLowerCase();
    const extension = fileName.split('.').pop();

    const isAllowedImage =
      mimeType.startsWith('image/') && supportedImageMimeTypes.includes(mimeType)
      || supportedImageExtensions.includes(extension);

    if (isAllowedImage) {
      cb(null, true);
    } else {
      cb(new Error('Only common image files are allowed (JPG, PNG, WebP, GIF, SVG, TIFF, HEIC, AVIF, etc.)'), false);
    }
  }
});

router.use(authenticateToken);

router.post('/', upload.single('photo'), validate(schemas.addPlace), addPlace);
router.get('/trip/:trip_id', getTripPlaces);
router.put('/:place_id', updatePlace);
router.delete('/:place_id', deletePlace);

export default router;
