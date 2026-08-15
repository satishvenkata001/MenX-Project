import { WishlistService } from '../services/wishlist.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export class WishlistController {
  /**
   * GET /api/v1/wishlist
   */
  static getWishlist = asyncHandler(async (req, res) => {
    const result = await WishlistService.getWishlist(req.user.id);
    return sendSuccess(res, result.items, 'Wishlist retrieved successfully', {
      wishlistId: result.wishlistId,
      itemCount: result.itemCount
    });
  });

  /**
   * POST /api/v1/wishlist/items
   */
  static addToWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const result = await WishlistService.addToWishlist(req.user.id, productId);
    return sendCreated(res, result.item, result.message);
  });

  /**
   * DELETE /api/v1/wishlist/items/:productId
   */
  static removeFromWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const result = await WishlistService.removeFromWishlist(req.user.id, productId);
    return sendSuccess(res, null, result.message);
  });
}
