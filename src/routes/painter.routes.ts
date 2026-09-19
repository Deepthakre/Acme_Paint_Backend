import { Router } from 'express';
import * as ctrl from '../controllers/painter.controller';
import { validate } from '../middleware/validate';
import {
  registerPainterSchema,
  claimRewardSchema,
  withdrawalSchema,
  painterIdParamSchema,
  mobileParamSchema,
} from '../validators/painter.validators';
import { paginationQuerySchema } from '../validators/common.validators';
import { requireAuth, requireRole } from '../middleware/auth';
import { registerRateLimiter } from '../middleware/rateLimiters';

const router = Router();

// The painter loyalty program is consumer-facing (no separate painter login
// system) — these are intentionally public, but still rate-limited and
// fully validated/atomic at the model layer against double-claim/double-spend.
router.post('/register', registerRateLimiter, validate({ body: registerPainterSchema }), ctrl.registerPainter);
router.get('/by-mobile/:mobile', validate({ params: mobileParamSchema }), ctrl.getPainterByMobile);
router.get('/:painterId/dashboard', validate({ params: painterIdParamSchema }), ctrl.getPainterDashboard);
router.post('/claim-reward', validate({ body: claimRewardSchema }), ctrl.claimPainterReward);
router.post('/:painterId/withdraw', validate({ params: painterIdParamSchema, body: withdrawalSchema }), ctrl.requestPainterWithdrawal);

// Admin-only: view/manage withdrawal requests.
router.get('/admin/withdrawals', requireAuth, requireRole('admin'), validate({ query: paginationQuerySchema }), ctrl.listWithdrawals);

export default router;
