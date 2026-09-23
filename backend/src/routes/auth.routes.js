import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import {
  loginSchema,
  refreshSchema,
  requestPasswordResetSchema,
  signupSchema,
  updatePasswordSchema,
  exchangeCodeSchema,
  verifyOtpSchema,
  resendOtpSchema,
  resendVerificationSchema
} from '../validators/auth.validator.js';

const router = Router();

// Public Authentication Routes with rate limiting & Zod validation
router.post('/signup', authLimiter, validateRequest(signupSchema), AuthController.signup);
router.post('/login', authLimiter, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', authLimiter, validateRequest(refreshSchema), AuthController.refresh);
router.post('/password-reset', authLimiter, validateRequest(requestPasswordResetSchema), AuthController.requestPasswordReset);
router.post('/exchange-code', authLimiter, validateRequest(exchangeCodeSchema), AuthController.exchangeCode);
router.post('/verify-otp', authLimiter, validateRequest(verifyOtpSchema), AuthController.verifyOtp);
router.post('/resend-verification', authLimiter, validateRequest(resendVerificationSchema), AuthController.resendVerification);
router.post('/resend-otp', authLimiter, validateRequest(resendOtpSchema), AuthController.resendOtp);

// Protected Authentication Routes
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);
router.post('/password-update', requireAuth, validateRequest(updatePasswordSchema), AuthController.updatePassword);
router.put('/profile', requireAuth, AuthController.updateProfile);

export default router;
