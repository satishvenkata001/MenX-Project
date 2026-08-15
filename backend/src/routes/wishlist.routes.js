import { Router } from 'express';
import { WishlistController } from '../controllers/wishlist.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { addToWishlistSchema, productIdParamSchema } from '../validators/cart.validator.js';

const router = Router();

// Wishlist requires authenticated user
router.use(requireAuth);

router.get('/', WishlistController.getWishlist);
router.post('/items', validateRequest(addToWishlistSchema), WishlistController.addToWishlist);
router.delete('/items/:productId', validateRequest(productIdParamSchema), WishlistController.removeFromWishlist);

export default router;
