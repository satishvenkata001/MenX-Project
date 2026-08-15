import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  /**
   * Registers a new user account with Supabase Auth
   */
  static async signup({ email, password, firstName, lastName, phone }) {
    const authClient = createAuthClient();

    // Create user via Supabase Admin (auto-confirms email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || null
      }
    });

    if (authError || !authData.user) {
      logger.warn('Signup failed in Supabase Auth', { error: authError?.message });
      throw AppError.badRequest(authError?.message || 'Failed to create user account');
    }

    const userId = authData.user.id;

    // Fetch the newly created profile (populated by DB trigger on_auth_user_created)
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Fallback: If DB trigger delayed or manual sync needed
    if (!profile) {
      const { data: createdProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          first_name: firstName,
          last_name: lastName || null,
          email,
          phone: phone || '',
          role: 'CUSTOMER'
        })
        .select()
        .single();

      if (!profileErr && createdProfile) {
        profile = createdProfile;
      }
    }

    // Auto-login using isolated auth client to generate access session
    const { data: loginData } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        createdAt: authData.user.created_at
      },
      profile: profile || null,
      session: loginData?.session ? {
        accessToken: loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        expiresIn: loginData.session.expires_in,
        expiresAt: loginData.session.expires_at,
        tokenType: loginData.session.token_type
      } : null
    };
  }

  /**
   * Authenticates user with email & password
   */
  static async login({ email, password }) {
    const authClient = createAuthClient();

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      logger.warn('Login failed: Invalid credentials', { email });
      throw AppError.unauthorized('Invalid email address or password');
    }

    // Fetch user profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileErr || !profile) {
      throw AppError.unauthorized('User profile not found. Please contact support.');
    }

    if (profile.is_active === false) {
      throw AppError.forbidden('Your account has been deactivated. Please contact support.');
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      profile,
      session: {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresIn: authData.session.expires_in,
        expiresAt: authData.session.expires_at,
        tokenType: authData.session.token_type
      }
    };
  }

  /**
   * Refreshes an expired session using a refresh token
   */
  static async refreshSession(refreshToken) {
    const authClient = createAuthClient();

    const { data: authData, error: authError } = await authClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (authError || !authData.session) {
      logger.warn('Refresh session failed', { error: authError?.message });
      throw AppError.unauthorized('Invalid or expired refresh token. Please log in again.');
    }

    return {
      session: {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresIn: authData.session.expires_in,
        expiresAt: authData.session.expires_at,
        tokenType: authData.session.token_type
      }
    };
  }

  /**
   * Requests a password reset email
   */
  static async requestPasswordReset(email) {
    const authClient = createAuthClient();
    const { error } = await authClient.auth.resetPasswordForEmail(email);

    if (error) {
      logger.warn('Password reset request failed', { error: error.message });
    }

    return {
      message: 'If an account with this email exists, a password reset link has been sent.'
    };
  }

  /**
   * Updates user password for authenticated session
   */
  static async updatePassword(userId, newPassword) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      logger.warn('Update password failed', { error: error.message });
      throw AppError.badRequest('Failed to update password. Please try again.');
    }

    return {
      message: 'Password updated successfully.'
    };
  }

  /**
   * Fetches full profile by user ID
   */
  static async getProfile(userId) {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw AppError.notFound('Profile not found');
    }

    return profile;
  }
}
