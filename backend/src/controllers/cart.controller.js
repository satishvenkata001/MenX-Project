import { CartService } from '../services/cart.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export class CartController {
  static getContext(req) {
    const userId = req.user?.id || null;
    const guestToken = req.headers['x-guest-token'] || req.query?.guestToken || null;
    return { userId, guestToken };
  }

  static attachGuestHeader(res, guestToken) {
    if (guestToken) {
      res.setHeader('X-Guest-Token', guestToken);
    }
  }

  /**
   * GET /api/v1/cart
   */
  static getCart = asyncHandler(async (req, res) => {
    const { userId, guestToken } = CartController.getContext(req);
    const cart = await CartService.getCart(userId, guestToken);
    CartController.attachGuestHeader(res, cart.guestToken);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: cart.guestToken,
      items: cart.items,
      summary: cart.summary
    }, 'Cart retrieved successfully');
  });

  /**
   * POST /api/v1/cart/items
   */
  static addItem = asyncHandler(async (req, res) => {
    const { userId, guestToken } = CartController.getContext(req);
    const cart = await CartService.addItem(req.body, userId, guestToken);
    CartController.attachGuestHeader(res, cart.guestToken);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: cart.guestToken,
      items: cart.items,
      summary: cart.summary
    }, 'Item added to cart successfully');
  });

  /**
   * PATCH /api/v1/cart/items/:id
   */
  static updateItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    const { userId, guestToken } = CartController.getContext(req);

    const cart = await CartService.updateItemQuantity(id, quantity, userId, guestToken);
    CartController.attachGuestHeader(res, cart.guestToken);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: cart.guestToken,
      items: cart.items,
      summary: cart.summary
    }, 'Cart item updated successfully');
  });

  /**
   * DELETE /api/v1/cart/items/:id
   */
  static removeItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId, guestToken } = CartController.getContext(req);

    const cart = await CartService.removeItem(id, userId, guestToken);
    CartController.attachGuestHeader(res, cart.guestToken);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: cart.guestToken,
      items: cart.items,
      summary: cart.summary
    }, 'Cart item removed successfully');
  });

  /**
   * DELETE /api/v1/cart
   */
  static clearCart = asyncHandler(async (req, res) => {
    const { userId, guestToken } = CartController.getContext(req);

    const cart = await CartService.clearCart(userId, guestToken);
    CartController.attachGuestHeader(res, cart.guestToken);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: cart.guestToken,
      items: cart.items,
      summary: cart.summary
    }, 'Cart cleared successfully');
  });

  /**
   * POST /api/v1/cart/merge
   */
  static mergeCart = asyncHandler(async (req, res) => {
    const { guestToken } = req.body;
    const cart = await CartService.mergeGuestCart(guestToken, req.user.id);

    return sendSuccess(res, {
      cartId: cart.cartId,
      guestToken: null,
      items: cart.items,
      summary: cart.summary
    }, 'Guest cart merged successfully');
  });
}
