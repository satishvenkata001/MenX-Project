import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    firstName: z.string().min(1, 'First name is required').max(50, 'First name must be under 50 characters'),
    lastName: z.string().max(50, 'Last name must be under 50 characters').optional().nullable(),
    phone: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid phone number format').optional().nullable()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required')
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
});

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format')
  })
});

export const updatePasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters long')
  })
});
