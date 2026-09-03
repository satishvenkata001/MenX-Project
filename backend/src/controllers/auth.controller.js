import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export class AuthController {
  /**
   * POST /api/v1/auth/signup
   */
  static signup = asyncHandler(async (req, res) => {
    const result = await AuthService.signup(req.body);
    return sendCreated(res, result, 'Account registered successfully.');
  });

  /**
   * POST /api/v1/auth/login
   */
  static login = asyncHandler(async (req, res) => {
    const result = await AuthService.login(req.body);
    return sendSuccess(res, result, 'Login successful.');
  });

  /**
   * POST /api/v1/auth/refresh
   */
  static refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshSession(refreshToken);
    return sendSuccess(res, result, 'Session refreshed successfully.');
  });

  /**
   * POST /api/v1/auth/logout
   */
  static logout = asyncHandler(async (req, res) => {
    return sendSuccess(res, null, 'Logged out successfully.');
  });

  /**
   * GET /api/v1/auth/me (Protected)
   */
  static getMe = asyncHandler(async (req, res) => {
    const profile = await AuthService.getProfile(req.user.id);
    return sendSuccess(res, {
      user: {
        id: req.user.id,
        email: req.user.email,
        createdAt: req.user.created_at
      },
      profile
    }, 'User profile retrieved successfully.');
  });

  /**
   * POST /api/v1/auth/password-reset
   */
  static requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.requestPasswordReset(email);
    return sendSuccess(res, result);
  });

  /**
   * POST /api/v1/auth/exchange-code
   */
  static exchangeCode = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const result = await AuthService.exchangeCode(code);
    return sendSuccess(res, result, 'Code exchanged successfully.');
  });

  /**
   * POST /api/v1/auth/verify-otp
   */
  static verifyOtp = asyncHandler(async (req, res) => {
    const { email, token } = req.body;
    const result = await AuthService.verifyOtp(email, token);
    return sendSuccess(res, result, 'Email verified successfully.');
  });

  /**
   * POST /api/v1/auth/resend-otp
   */
  static resendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await AuthService.resendOtp(email);
    return sendSuccess(res, result, 'Verification code resent successfully.');
  });

  /**
   * POST /api/v1/auth/password-update (Protected)
   */
  static updatePassword = asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    const result = await AuthService.updatePassword(req.user.id, newPassword);
    return sendSuccess(res, result);
  });

  /**
   * PUT /api/v1/auth/profile (Protected)
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone } = req.body;
    const result = await AuthService.updateProfile(req.user.id, { firstName, lastName, phone });
    return sendSuccess(res, result, 'Profile updated successfully.');
  });
}
