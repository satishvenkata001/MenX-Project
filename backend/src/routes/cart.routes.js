import { Router } from 'express';
import { CartController } from '../controllers/cart.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  addToCartSchema,
  mergeCartSchema,
  updateCartItemSchema
} from '../validators/cart.validator.js';
import { idParamSchema } from '../validators/catalog.validator.js';

const router = Router();

// Public / Guest / Customer Cart Routes (with optional auth)
router.get('/', optionalAuth, CartController.getCart);
router.post('/items', optionalAuth, validateRequest(addToCartSchema), CartController.addItem);
router.patch('/items/:id', optionalAuth, validateRequest(updateCartItemSchema), CartController.updateItem);
router.delete('/items/:id', optionalAuth, validateRequest(idParamSchema), CartController.removeItem);
router.delete('/', optionalAuth, CartController.clearCart);

// Merge Guest Cart into Authenticated Customer Cart (requires authentication)
router.post('/merge', requireAuth, validateRequest(mergeCartSchema), CartController.mergeCart);

export default router;
