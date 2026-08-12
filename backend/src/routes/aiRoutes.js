// src/routes/aiRoutes.js
import express from 'express';
import {
  getSuggestedCategory,
  getSettlementExplanation,
  copilotChat,
} from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Non-blocking category suggestion — no auth required
router.get('/suggest-category', getSuggestedCategory);

// Settlement natural-language explanation
router.get('/trips/:trip_id/settlement-explain', authenticateToken, getSettlementExplanation);

// AI Financial Copilot — answers natural-language questions about trip spending
router.post('/trips/:trip_id/copilot', authenticateToken, copilotChat);

export default router;
