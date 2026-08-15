import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class WishlistService {
  /**
   * Helper to get or create a customer's wishlist
   */
  static async getOrCreateWishlist(userId) {
    let { data: wishlist, error } = await supabaseAdmin
      .from('wishlists')
      .select('id, user_id, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wishlist) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('wishlists')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createErr || !created) {
        logger.error('Failed to create wishlist', { error: createErr?.message });
        throw AppError.internal('Failed to initialize wishlist');
      }
      wishlist = created;
    }

    return wishlist;
  }

  /**
   * Retrieve customer's wishlist with product summaries
   */
  static async getWishlist(userId) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const { data: rawItems, error } = await supabaseAdmin
      .from('wishlist_items')
      .select(`
        id, product_id, created_at,
        product:products(
          id, title, slug, status, base_mrp, base_price,
          category:categories(id, name, slug),
          brand:brands(id, name, slug),
          images:product_images(image_url, is_primary, display_order)
        )
      `)
      .eq('wishlist_id', wishlist.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch wishlist items', { error: error.message });
      throw AppError.internal('Failed to retrieve wishlist items');
    }

    const items = (rawItems || [])
      .filter(item => item.product && item.product.status === 'PUBLISHED')
      .map(item => {
        const p = item.product;
        const primaryImage = (p.images || []).sort(
          (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order
        )[0];

        const discountPercent = p.base_mrp > p.base_price
          ? Math.round(((p.base_mrp - p.base_price) / p.base_mrp) * 100)
          : 0;

        return {
          id: item.id,
          productId: p.id,
          title: p.title,
          slug: p.slug,
          thumbnailUrl: primaryImage?.image_url || null,
          category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
          brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null,
          price: {
            mrp: p.base_mrp,
            sellingPrice: p.base_price,
            discountPercent
          },
          addedAt: item.created_at
        };
      });

    return {
      wishlistId: wishlist.id,
      itemCount: items.length,
      items
    };
  }

  /**
   * Add a product to the customer's wishlist
   */
  static async addToWishlist(userId, productId) {
    // 1. Verify product exists and is PUBLISHED
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, title, slug, status')
      .eq('id', productId)
      .single();

    if (prodErr || !product || product.status !== 'PUBLISHED') {
      throw AppError.badRequest('Product not found or not currently available');
    }

    // 2. Get or initialize wishlist
    const wishlist = await this.getOrCreateWishlist(userId);

    // 3. Check for existing item to avoid duplicate errors
    const { data: existing } = await supabaseAdmin
      .from('wishlist_items')
      .select('id, product_id, created_at')
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      return {
        message: 'Product is already in your wishlist',
        item: existing
      };
    }

    // 4. Insert wishlist item
    const { data: newItem, error: insertErr } = await supabaseAdmin
      .from('wishlist_items')
      .insert({
        wishlist_id: wishlist.id,
        product_id: productId
      })
      .select()
      .single();

    if (insertErr || !newItem) {
      logger.error('Failed to add product to wishlist', { error: insertErr?.message });
      throw AppError.internal('Failed to add product to wishlist');
    }

    return {
      message: 'Product added to wishlist successfully',
      item: newItem
    };
  }

  /**
   * Remove a product from the customer's wishlist
   */
  static async removeFromWishlist(userId, productId) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const { error } = await supabaseAdmin
      .from('wishlist_items')
      .delete()
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId);

    if (error) {
      logger.error('Failed to remove product from wishlist', { error: error.message });
      throw AppError.internal('Failed to remove product from wishlist');
    }

    return {
      message: 'Product removed from wishlist successfully'
    };
  }
}
