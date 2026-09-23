import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import { api } from '../utils/api.js';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getErrorMessage = (errStr) => {
    if (!errStr) return '';
    const lower = errStr.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('too many requests')) {
      return 'Too many verification emails requested. Please wait before requesting another code.';
    }
    return errStr;
  };

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function handleIncomingSession() {
      try {
        setError('');
        
        // 1. Check for Hash Fragment parameters (Implicit Recovery flow)
        const hash = location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const type = params.get('type');
          
          if (accessToken && type === 'recovery') {
            setToken(accessToken);
            setLoading(false);
            return;
          }
        }

        // 2. Check for Code Query parameter (PKCE flow)
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        
        if (code) {
          // Exchange the PKCE code via our backend
          const res = await api.post('/auth/exchange-code', { code });
          if (res.data?.session?.accessToken) {
            setToken(res.data.session.accessToken);
            setLoading(false);
            return;
          }
        }

        // If no code and no access token, or type is not recovery
        throw new Error('This password reset link is invalid or has expired.');
      } catch (err) {
        console.error('Session resolution failed:', err.message);
        setError(err.message || 'Failed to verify password reset link.');
        setLoading(false);
      }
    }

    handleIncomingSession();
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation checks
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      await api.post(
        '/auth/password-update',
        { newPassword: password },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setSuccess('Your password has been successfully updated.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Password update failed:', err.message);
      setError(err.message || 'Failed to update password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseLayout>
      <div className="flex-grow flex items-center justify-center p-6 bg-menx-bg">
        <div className="w-full max-w-md menx-card rounded-2xl shadow-2xl overflow-hidden p-8 space-y-6">
          
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 bg-menx-primary/10 border border-menx-primary/30 rounded-xl flex items-center justify-center text-menx-primary">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white text-center">
              Create New Password
            </h2>
            <p className="text-xs text-menx-text-secondary text-center">
              Please enter and confirm your new secure password.
            </p>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-menx-primary"></div>
              <span className="text-xs text-menx-text-muted font-medium">Validating security link...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 bg-menx-error/10 border border-menx-error/20 text-menx-error text-xs rounded-lg flex items-start space-x-2 font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{getErrorMessage(error)}</span>
                </div>
              )}

              {success && (
                <div className="p-4 bg-menx-success/10 border border-menx-success/20 text-menx-success text-xs rounded-lg flex items-start space-x-2 font-medium">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{success}</p>
                    <p className="mt-1 text-menx-text-secondary">Redirecting to login in 3 seconds...</p>
                  </div>
                </div>
              )}

              {!success && token && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-menx-text-secondary">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                          placeholder="At least 8 characters"
                        />
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-menx-text-secondary">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-menx-text-muted" />
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-menx-bg border border-menx-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-menx-primary transition-colors"
                          placeholder="Repeat new password"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                    ) : (
                      <span>Reset Password</span>
                    )}
                  </button>
                </form>
              )}

              {/* Back to Login options if link error or successful reset */}
              {(error || success || !token) && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center space-x-2 text-xs font-semibold text-menx-text-secondary hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </BaseLayout>
  );
}
