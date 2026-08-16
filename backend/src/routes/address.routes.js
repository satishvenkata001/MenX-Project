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
  recipientName: z.string().min(1, 'Recipient name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  alternatePhone: z.string().optional().nullable(),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  addressType: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  isDefault: z.boolean().default(false)
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
      postal_code: postalCode,
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

export default router;
