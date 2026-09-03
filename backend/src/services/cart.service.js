import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class CartService {
  /**
   * Generates a cryptographically secure, unpredictable guest session token
   */
  static generateGuestToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Resolves or initializes cart for authenticated customer or guest session
   */
  static async resolveCart(userId, guestToken) {
    if (userId) {
      // 1. Authenticated customer cart
      const { data: carts } = await supabaseAdmin
        .from('carts')
        .select('id, user_id, expires_at, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      let cart = carts && carts.length > 0 ? carts[0] : null;

      if (!cart) {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('carts')
          .insert({ user_id: userId })
          .select()
          .single();

        if (createErr || !created) {
          logger.error('Failed to create customer cart', { error: createErr?.message });
          throw AppError.internal('Failed to initialize cart');
        }
        cart = created;
      } else if (carts.length > 1) {
        // Consolidate items from duplicate carts to the primary cart
        const duplicateIds = carts.slice(1).map(c => c.id);
        for (const dup of carts.slice(1)) {
          await supabaseAdmin.from('cart_items').update({ cart_id: cart.id }).eq('cart_id', dup.id);
        }
        await supabaseAdmin.from('carts').delete().in('id', duplicateIds);
      }

      return { cart, guestToken: null };
    }

    // 2. Guest session cart
    if (guestToken) {
      const { data: existingGuestCart } = await supabaseAdmin
        .from('carts')
        .select('id, session_token, expires_at, created_at, updated_at')
        .eq('session_token', guestToken)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingGuestCart) {
        return { cart: existingGuestCart, guestToken };
      }
    }

    // Generate new guest cart with secure token
    const newToken = this.generateGuestToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newGuestCart, error: guestCreateErr } = await supabaseAdmin
      .from('carts')
      .insert({
        session_token: newToken,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (guestCreateErr || !newGuestCart) {
      logger.error('Failed to create guest cart', { error: guestCreateErr?.message });
      throw AppError.internal('Failed to initialize guest cart');
    }

    return { cart: newGuestCart, guestToken: newToken };
  }

  /**
   * Helper to fetch available stock across all stores for a variant
   */
  static async getAvailableStock(variantId) {
    const { data: items, error } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available')
      .eq('variant_id', variantId);

    if (error) {
      logger.warn(`Failed to fetch inventory for variant ${variantId}`, { error: error.message });
      return 0;
    }

    return (items || []).reduce((sum, item) => sum + (item.quantity_available || 0), 0);
  }

  /**
   * Retrieve cart with formatted line items, current database prices, and summary calculations
   */
  static async getCart(userId, guestToken) {
    const { cart, guestToken: resolvedGuestToken } = await this.resolveCart(userId, guestToken);

    const { data: rawItems, error: itemsErr } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id, cart_id, variant_id, outfit_id, quantity, created_at, updated_at,
        outfit:outfits(id, title, slug),
        variant:product_variants(
          id, sku, barcode, mrp, selling_price, is_active,
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code),
          product:products(
            id, title, slug, status,
            images:product_images(image_url, is_primary, display_order)
          )
        )
      `)
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      logger.error('Failed to retrieve cart items', { error: itemsErr.message });
      throw AppError.internal('Failed to retrieve cart items');
    }

    // Fetch stock for all variants in the cart
    const variantIds = (rawItems || []).map(i => i.variant_id);
    let stockMap = {};
    if (variantIds.length > 0) {
      const { data: stockRecords } = await supabaseAdmin
        .from('inventory_items')
        .select('variant_id, quantity_available')
        .in('variant_id', variantIds);

      (stockRecords || []).forEach(sr => {
        stockMap[sr.variant_id] = (stockMap[sr.variant_id] || 0) + (sr.quantity_available || 0);
      });
    }

    let totalQuantity = 0;
    let subtotal = 0;
    let mrpSubtotal = 0;

    const items = (rawItems || []).map(item => {
      const v = item.variant;
      const p = v?.product;

      const primaryImage = (p?.images || []).sort(
        (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order
      )[0];

      const unitPrice = v ? Number(v.selling_price) : 0;
      const mrp = v ? Number(v.mrp) : 0;
      const quantity = item.quantity;
      const lineTotal = unitPrice * quantity;
      const mrpLineTotal = mrp * quantity;
      const availableStock = stockMap[item.variant_id] || 0;

      const isPublished = p?.status === 'PUBLISHED';
      const isVariantActive = v?.is_active === true;
      const isAvailable = isPublished && isVariantActive && availableStock >= quantity;

      totalQuantity += quantity;
      subtotal += lineTotal;
      mrpSubtotal += mrpLineTotal;

      return {
        id: item.id,
        variantId: item.variant_id,
        productId: p?.id || null,
        productTitle: p?.title || 'Unknown Product',
        productSlug: p?.slug || '',
        sku: v?.sku || '',
        size: v?.size?.name || null,
        color: v?.color?.name || null,
        thumbnailUrl: primaryImage?.image_url || null,
        unitPrice,
        mrp,
        quantity,
        lineTotal,
        mrpLineTotal,
        availableStock,
        isAvailable,
        outfit: item.outfit ? { id: item.outfit.id, title: item.outfit.title, slug: item.outfit.slug } : null
      };
    });

    const totalDiscount = mrpSubtotal > subtotal ? mrpSubtotal - subtotal : 0;
    const isValidForCheckout = items.length > 0 && items.every(i => i.isAvailable);

    return {
      cartId: cart.id,
      guestToken: resolvedGuestToken,
      items,
      summary: {
        itemCount: items.length,
        totalQuantity,
        subtotal,
        mrpSubtotal,
        totalDiscount,
        isValidForCheckout
      }
    };
  }

  /**
   * Add variant item to cart with stock validation and database price lookup
   */
  static async addItem({ variantId, quantity = 1, outfitId = null }, userId, guestToken) {
    if (quantity <= 0) {
      throw AppError.badRequest('Quantity must be greater than zero');
    }

    if (quantity > 10) {
      throw AppError.badRequest('Maximum 10 units allowed per item in cart');
    }

    // 1. Verify variant exists and is active
    const { data: variant, error: varErr } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id, product_id, is_active, sku, selling_price, mrp,
        product:products(id, title, status)
      `)
      .eq('id', variantId)
      .single();

    if (varErr || !variant || !variant.is_active) {
      throw AppError.badRequest('Selected product variant is not available');
    }

    if (variant.product?.status !== 'PUBLISHED') {
      throw AppError.badRequest('Product is not currently available for purchase');
    }

    // 2. Resolve or create cart
    const { cart, guestToken: resolvedGuestToken } = await this.resolveCart(userId, guestToken);

    // 3. Check available stock
    const availableStock = await this.getAvailableStock(variantId);

    // 4. Check if item already exists in this cart
    const { data: existingItem } = await supabaseAdmin
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('variant_id', variantId)
      .maybeSingle();

    const targetQuantity = (existingItem?.quantity || 0) + quantity;

    if (targetQuantity > availableStock) {
      throw AppError.badRequest(
        `Requested quantity (${targetQuantity}) exceeds available stock (${availableStock}) for ${variant.product?.title}`
      );
    }

    if (targetQuantity > 10) {
      throw AppError.badRequest('Cannot add more than 10 units of this item to your cart');
    }

    // 5. Insert or update item in cart
    if (existingItem) {
      const { error: updateErr } = await supabaseAdmin
        .from('cart_items')
        .update({
          quantity: targetQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);

      if (updateErr) {
        logger.error('Failed to update cart item quantity', { error: updateErr.message });
        throw AppError.internal('Failed to update cart item');
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          variant_id: variantId,
          outfit_id: outfitId || null,
          quantity: targetQuantity
        });

      if (insertErr) {
        logger.error('Failed to insert item into cart', { error: insertErr.message });
        throw AppError.internal('Failed to add item to cart');
      }
    }

    return this.getCart(userId, resolvedGuestToken);
  }

  /**
   * Update quantity of a specific cart item
   */
  static async updateItemQuantity(cartItemId, quantity, userId, guestToken) {
    if (quantity <= 0) {
      throw AppError.badRequest('Quantity must be greater than zero. To remove the item, please delete it.');
    }

    if (quantity > 10) {
      throw AppError.badRequest('Maximum 10 units allowed per item in cart');
    }

    const { cart, guestToken: resolvedGuestToken } = await this.resolveCart(userId, guestToken);

    // Verify item belongs to this cart
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('cart_items')
      .select('id, cart_id, variant_id')
      .eq('id', cartItemId)
      .eq('cart_id', cart.id)
      .single();

    if (itemErr || !item) {
      throw AppError.notFound('Cart item not found in your shopping cart');
    }

    // Validate available stock
    const availableStock = await this.getAvailableStock(item.variant_id);
    if (quantity > availableStock) {
      throw AppError.badRequest(
        `Requested quantity (${quantity}) exceeds available stock (${availableStock})`
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from('cart_items')
      .update({
        quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    if (updateErr) {
      logger.error('Failed to update cart item', { error: updateErr.message });
      throw AppError.internal('Failed to update cart item');
    }

    return this.getCart(userId, resolvedGuestToken);
  }

  /**
   * Remove a single item from the cart
   */
  static async removeItem(cartItemId, userId, guestToken) {
    const { cart, guestToken: resolvedGuestToken } = await this.resolveCart(userId, guestToken);

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('id', cartItemId)
      .eq('cart_id', cart.id);

    if (error) {
      logger.error('Failed to remove cart item', { error: error.message });
      throw AppError.internal('Failed to remove cart item');
    }

    return this.getCart(userId, resolvedGuestToken);
  }

  /**
   * Clear all items in the cart
   */
  static async clearCart(userId, guestToken) {
    const { cart, guestToken: resolvedGuestToken } = await this.resolveCart(userId, guestToken);

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (error) {
      logger.error('Failed to clear cart', { error: error.message });
      throw AppError.internal('Failed to clear cart');
    }

    return this.getCart(userId, resolvedGuestToken);
  }

  /**
   * Merges a guest cart into the authenticated customer's cart
   */
  static async mergeGuestCart(guestToken, userId) {
    if (!guestToken || !userId) {
      throw AppError.badRequest('Guest token and user authentication required for merge');
    }

    // 1. Locate guest cart
    const { data: guestCart } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('session_token', guestToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!guestCart) {
      return this.getCart(userId, null);
    }

    // 2. Fetch guest cart items
    const { data: guestItems } = await supabaseAdmin
      .from('cart_items')
      .select('variant_id, outfit_id, quantity')
      .eq('cart_id', guestCart.id);

    if (!guestItems || guestItems.length === 0) {
      await supabaseAdmin.from('carts').delete().eq('id', guestCart.id);
      return this.getCart(userId, null);
    }

    // 3. Resolve customer cart
    const { cart: customerCart } = await this.resolveCart(userId, null);

    // 4. Fetch existing customer cart items
    const { data: customerItems } = await supabaseAdmin
      .from('cart_items')
      .select('id, variant_id, quantity')
      .eq('cart_id', customerCart.id);

    const customerItemMap = new Map((customerItems || []).map(i => [i.variant_id, i]));

    // 5. Merge each guest item
    for (const gItem of guestItems) {
      const availableStock = await this.getAvailableStock(gItem.variant_id);
      const existing = customerItemMap.get(gItem.variant_id);

      if (existing) {
        const mergedQty = Math.min(existing.quantity + gItem.quantity, availableStock, 10);
        if (mergedQty > 0) {
          await supabaseAdmin
            .from('cart_items')
            .update({
              quantity: mergedQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } else {
        const newQty = Math.min(gItem.quantity, availableStock, 10);
        if (newQty > 0) {
          await supabaseAdmin
            .from('cart_items')
            .insert({
              cart_id: customerCart.id,
              variant_id: gItem.variant_id,
              outfit_id: gItem.outfit_id || null,
              quantity: newQty
            });
        }
      }
    }

    // 6. Invalidate/delete the guest cart
    await supabaseAdmin
      .from('carts')
      .delete()
      .eq('id', guestCart.id);

    return this.getCart(userId, null);
  }
}
