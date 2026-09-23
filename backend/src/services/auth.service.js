import { supabaseAdmin, createAuthClient, createUserClient } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { invalidateAuthCache } from '../middleware/auth.js';

export class AuthService {
  /**
   * Registers a new user account with Supabase Auth
   */
  static async signup({ email, password, firstName, lastName, phone }) {
    const authClient = createAuthClient();

    // Standard Supabase signUp (sends email verification link)
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null
        },
        emailRedirectTo: `${env.FRONTEND_URL}/login`
      }
    });

    if (authError || !authData.user) {
      logger.warn('Signup failed in Supabase Auth', { error: authError?.message });
      throw AppError.badRequest(authError?.message || 'Failed to create user account');
    }

    // Handle already registered/verified accounts
    if (authData.user.identities && authData.user.identities.length === 0) {
      throw AppError.badRequest('An account with this email address already exists.');
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

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        createdAt: authData.user.created_at
      },
      profile: profile || null,
      session: null // New customer registration requires email verification before session is granted
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

    if (authError) {
      if (authError.message && authError.message.toLowerCase().includes('confirm')) {
        throw AppError.forbidden('Email not confirmed. Please verify your email first.');
      }
      logger.warn('Login failed: Invalid credentials', { email });
      throw AppError.unauthorized('Invalid email address or password');
    }

    if (!authData.user || !authData.session) {
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
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      logger.warn('Password reset request failed', { error: error.message });
    }

    return {
      message: 'If an account with this email exists, a password reset link has been sent.'
    };
  }

  /**
   * Exchanges a PKCE code for a user session and synchronizes user profiles
   */
  static async exchangeCode(code) {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.session.user) {
      logger.warn('Code exchange failed', { error: error?.message });
      throw AppError.badRequest(error?.message || 'Failed to exchange authentication code');
    }

    const user = data.session.user;
    const userId = user.id;
    const email = user.email;

    // Fetch existing profile if available
    let { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      logger.info('No profile found during code exchange. Creating new profile...', { userId, email });

      const userMeta = user.user_metadata || {};
      const firstName = userMeta.given_name || userMeta.first_name || userMeta.name || email.split('@')[0];
      const lastName = userMeta.family_name || userMeta.last_name || '';

      const { data: createdProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          first_name: firstName,
          last_name: lastName || null,
          email,
          phone: '',
          role: 'CUSTOMER'
        })
        .select()
        .single();

      if (profileErr) {
        logger.error('Failed to create user profile during OAuth exchange', { error: profileErr.message });
      } else {
        profile = createdProfile;
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at
      },
      profile: profile || null,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type
      }
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

    invalidateAuthCache(userId);

    return {
      message: 'Password updated successfully.'
    };
  }

  /**
   * Verifies the 6-digit email confirmation OTP code
   */
  static async verifyOtp(email, token) {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error || !data.session) {
      logger.warn('OTP verification failed', { error: error?.message });
      throw AppError.badRequest(error?.message || 'Invalid or expired verification code');
    }

    // Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      user: {
        id: data.user.id,
        email: data.user.email
      },
      profile: profile || null,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type
      }
    };
  }

  /**
   * Resends the email confirmation verification link
   */
  static async resendVerification(email) {
    const authClient = createAuthClient();
    const { error } = await authClient.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${env.FRONTEND_URL}/login`
      }
    });

    if (error) {
      logger.warn('Resend verification email failed', { error: error.message });
      throw AppError.badRequest(error.message);
    }

    return {
      message: 'Verification link resent successfully. Please check your inbox.'
    };
  }

  /**
   * Alias for backwards compatibility
   */
  static async resendOtp(email) {
    return this.resendVerification(email);
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

  /**
   * Updates user profile
   */
  static async updateProfile(userId, { firstName, lastName, phone }) {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || ''
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !profile) {
      throw AppError.notFound('Profile not found');
    }

    invalidateAuthCache(userId);
    return profile;
  }
}
