import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { sendCreated, sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Zod validation schema for creating a new address
const addressSchema = z.object({
  body: z.object({
    recipientName: z.string().min(1, 'Recipient name is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    alternatePhone: z.string().optional().nullable(),
    addressLine1: z.string().min(1, 'Address line 1 is required'),
    addressLine2: z.string().optional().nullable(),
    landmark: z.string().optional().nullable(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postalCode: z.string().trim().regex(/^\d{6}$/, 'Postal code must be a valid 6-digit number'),
    addressType: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
    isDefault: z.boolean().default(false)
  })
});

/**
 * GET /api/v1/addresses
 * Retrieve all addresses belonging to the authenticated customer
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('addresses')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  // Format response keys to camelCase for frontend styling consistency
  const formatted = (data || []).map(addr => ({
    id: addr.id,
    recipientName: addr.recipient_name,
    phoneNumber: addr.phone_number,
    alternatePhone: addr.alternate_phone,
    addressLine1: addr.address_line1,
    addressLine2: addr.address_line2,
    landmark: addr.landmark,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postal_code,
    addressType: addr.address_type,
    isDefault: addr.is_default,
    createdAt: addr.created_at,
    updatedAt: addr.updated_at
  }));

  return sendSuccess(res, formatted, 'Addresses retrieved successfully');
}));

/**
 * POST /api/v1/addresses
 * Create a new address for the authenticated customer
 */
router.post('/', requireAuth, validateRequest(addressSchema), asyncHandler(async (req, res) => {
  const {
    recipientName,
    phoneNumber,
    alternatePhone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    postalCode,
    addressType,
    isDefault
  } = req.body;

  // If new address is set to default, reset all other addresses default flag to false first
  if (isDefault) {
    await supabaseAdmin
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', req.user.id);
  }

  const { data, error } = await supabaseAdmin
    .from('addresses')
    .insert({
      user_id: req.user.id,
      recipient_name: recipientName,
      phone_number: phoneNumber,
      alternate_phone: alternatePhone || null,
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      landmark: landmark || null,
      city,
      state,
      postal_code: postalCode.trim(),
      address_type: addressType,
      is_default: isDefault
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const formatted = {
    id: data.id,
    recipientName: data.recipient_name,
    phoneNumber: data.phone_number,
    alternatePhone: data.alternate_phone,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    landmark: data.landmark,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    addressType: data.address_type,
    isDefault: data.is_default,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  return sendCreated(res, formatted, 'Address created successfully');
}));

// Zod validation schema for updating an address
const updateAddressSchema = z.object({
  body: z.object({
    recipientName: z.string().min(1, 'Recipient name is required').optional(),
    phoneNumber: z.string().min(1, 'Phone number is required').optional(),
    alternatePhone: z.string().optional().nullable(),
    addressLine1: z.string().min(1, 'Address line 1 is required').optional(),
    addressLine2: z.string().optional().nullable(),
    landmark: z.string().optional().nullable(),
    city: z.string().min(1, 'City is required').optional(),
    state: z.string().min(1, 'State is required').optional(),
    postalCode: z.string().trim().regex(/^\d{6}$/, 'Postal code must be a valid 6-digit number').optional(),
    addressType: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
    isDefault: z.boolean().optional()
  })
});

/**
 * PUT /api/v1/addresses/:id
 * Update an existing address belonging to the authenticated customer
 */
router.put('/:id', requireAuth, validateRequest(updateAddressSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Verify ownership first
  const { data: existing, error: getError } = await supabaseAdmin
    .from('addresses')
    .select('user_id')
    .eq('id', id)
    .single();

  if (getError || !existing) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized to modify this address' });
  }

  // If set to default, reset all other addresses default flag to false first
  if (updates.isDefault) {
    await supabaseAdmin
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', req.user.id);
  }

  const { data, error } = await supabaseAdmin
    .from('addresses')
    .update({
      recipient_name: updates.recipientName,
      phone_number: updates.phoneNumber,
      alternate_phone: updates.alternatePhone,
      address_line1: updates.addressLine1,
      address_line2: updates.addressLine2,
      landmark: updates.landmark,
      city: updates.city,
      state: updates.state,
      postal_code: updates.postalCode !== undefined ? updates.postalCode.trim() : undefined,
      address_type: updates.addressType,
      is_default: updates.isDefault
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const formatted = {
    id: data.id,
    recipientName: data.recipient_name,
    phoneNumber: data.phone_number,
    alternatePhone: data.alternate_phone,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    landmark: data.landmark,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    addressType: data.address_type,
    isDefault: data.is_default,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  return sendSuccess(res, formatted, 'Address updated successfully');
}));

/**
 * DELETE /api/v1/addresses/:id
 * Delete an address belonging to the authenticated customer, resetting default cleanly
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify ownership first
  const { data: existing, error: getError } = await supabaseAdmin
    .from('addresses')
    .select('user_id, is_default')
    .eq('id', id)
    .single();

  if (getError || !existing) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized to delete this address' });
  }

  if (existing.is_default) {
    // Delete the default address
    const { error: deleteErr } = await supabaseAdmin
      .from('addresses')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    // Set the next most recent address as default so the user has one
    const { data: remaining } = await supabaseAdmin
      .from('addresses')
      .select('id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (remaining && remaining.length > 0) {
      await supabaseAdmin
        .from('addresses')
        .update({ is_default: true })
        .eq('id', remaining[0].id);
    }
  } else {
    const { error: deleteErr } = await supabaseAdmin
      .from('addresses')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;
  }

  return sendSuccess(res, null, 'Address deleted successfully');
}));

/**
 * PATCH /api/v1/addresses/:id/default
 * Mark a specific address as default, unsetting all others
 */
router.patch('/:id/default', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify ownership first
  const { data: existing, error: getError } = await supabaseAdmin
    .from('addresses')
    .select('user_id')
    .eq('id', id)
    .single();

  if (getError || !existing) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized to modify default address' });
  }

  // Set all user's addresses to not default
  await supabaseAdmin
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', req.user.id);

  // Set selected address to default
  const { data, error } = await supabaseAdmin
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const formatted = {
    id: data.id,
    recipientName: data.recipient_name,
    phoneNumber: data.phone_number,
    alternatePhone: data.alternate_phone,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    landmark: data.landmark,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    addressType: data.address_type,
    isDefault: data.is_default,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  return sendSuccess(res, formatted, 'Address marked as default successfully');
}));

export default router;
