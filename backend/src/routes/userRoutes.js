import express from 'express';
import { registerUser, getAllUsers, loginUser, getCurrentUser, forgotPassword, resetPassword } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', validate(schemas.register), registerUser);
router.post('/login', authRateLimiter, validate(schemas.login), loginUser);
router.get('/me', authenticateToken, getCurrentUser);
router.get('/', authenticateToken, getAllUsers);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

export default router;