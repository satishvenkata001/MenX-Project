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
          id, title, slug, status, base_mrp, base_price, description,
          category:categories(id, name, slug),
          subcategory:subcategories(id, name, slug),
          brand:brands(id, name, slug, logo_url),
          images:product_images(id, image_url, alt_text, is_primary, display_order),
          variants:product_variants(id, mrp, selling_price, is_active)
        )
      `)
      .eq('wishlist_id', wishlist.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch wishlist items', { error: error.message });
      throw AppError.internal('Failed to retrieve wishlist items');
    }

    const items = (rawItems || []).map(item => {
      const p = item.product;
      if (!p) {
        return {
          id: item.id,
          productId: item.product_id,
          product_id: item.product_id,
          title: 'Product Unavailable',
          slug: null,
          status: 'UNAVAILABLE',
          description: null,
          thumbnailUrl: null,
          imageUrl: null,
          category: null,
          subcategory: null,
          brand: null,
          price: {
            mrp: 0,
            sellingPrice: 0,
            discountPercent: 0
          },
          base_mrp: 0,
          base_price: 0,
          mrp: 0,
          sellingPrice: 0,
          selling_price: 0,
          variants: [],
          images: [],
          addedAt: item.created_at,
          created_at: item.created_at,
          product: null
        };
      }

      const imagesList = p.images || [];
      const primaryImage = [...imagesList].sort(
        (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order ?? 0) - (b.display_order ?? 0)
      )[0];

      const discountPercent = Number(p.base_mrp) > Number(p.base_price)
        ? Math.round(((Number(p.base_mrp) - Number(p.base_price)) / Number(p.base_mrp)) * 100)
        : 0;

      const productSummary = {
        id: p.id,
        productId: p.id,
        product_id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        description: p.description,
        thumbnailUrl: primaryImage?.image_url || null,
        imageUrl: primaryImage?.image_url || null,
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
        subcategory: p.subcategory ? { id: p.subcategory.id, name: p.subcategory.name, slug: p.subcategory.slug } : null,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug, logoUrl: p.brand.logo_url } : null,
        price: {
          mrp: Number(p.base_mrp),
          sellingPrice: Number(p.base_price),
          discountPercent
        },
        base_mrp: Number(p.base_mrp),
        base_price: Number(p.base_price),
        mrp: Number(p.base_mrp),
        sellingPrice: Number(p.base_price),
        selling_price: Number(p.base_price),
        variants: p.variants || [],
        images: imagesList,
        addedAt: item.created_at,
        created_at: item.created_at
      };

      return {
        id: item.id,
        productId: p.id,
        product_id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        description: p.description,
        thumbnailUrl: primaryImage?.image_url || null,
        imageUrl: primaryImage?.image_url || null,
        category: productSummary.category,
        subcategory: productSummary.subcategory,
        brand: productSummary.brand,
        price: productSummary.price,
        base_mrp: Number(p.base_mrp),
        base_price: Number(p.base_price),
        mrp: Number(p.base_mrp),
        sellingPrice: Number(p.base_price),
        selling_price: Number(p.base_price),
        variants: p.variants || [],
        images: imagesList,
        addedAt: item.created_at,
        created_at: item.created_at,
        product: productSummary
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
    // 1. Concurrently verify product exists and retrieve/initialize wishlist
    const [prodRes, wishlist] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select(`
          id, title, slug, status, base_mrp, base_price, description,
          category:categories(id, name, slug),
          subcategory:subcategories(id, name, slug),
          brand:brands(id, name, slug, logo_url),
          images:product_images(id, image_url, alt_text, is_primary, display_order),
          variants:product_variants(id, mrp, selling_price, is_active)
        `)
        .eq('id', productId)
        .single(),
      this.getOrCreateWishlist(userId)
    ]);

    const product = prodRes.data;
    if (prodRes.error || !product || product.status !== 'PUBLISHED') {
      throw AppError.badRequest('Product not found or not currently available');
    }

    // 2. Check for existing item to avoid duplicate errors
    const { data: existing } = await supabaseAdmin
      .from('wishlist_items')
      .select('id, product_id, created_at')
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      return {
        message: 'Product is already in your wishlist',
        item: {
          ...existing,
          product_id: productId,
          product
        }
      };
    }

    // 3. Insert wishlist item
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
      item: {
        ...newItem,
        product_id: productId,
        product
      }
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
