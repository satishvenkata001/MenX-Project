import { supabaseAdmin, createUserClient } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class CatalogService {
  // Helper to resolve client
  static getClient(token) {
    return token ? createUserClient(token) : supabaseAdmin;
  }

  // ============================================================================
  // PUBLIC CATALOG METHODS
  // ============================================================================

  /**
   * List all active categories
   */
  static async listCategories() {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug, description, image_url, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to list categories', { error: error.message });
      throw AppError.internal('Failed to retrieve categories');
    }

    return data || [];
  }

  /**
   * List all categories for administrative management (including inactive)
   */
  static async listAdminCategories() {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug, description, image_url, display_order, is_active, created_at, updated_at')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to list admin categories', { error: error.message });
      throw AppError.internal('Failed to retrieve categories');
    }

    return data || [];
  }

  /**
   * Get category details with nested active subcategories
   */
  static async getCategoryBySlug(slug) {
    const { data: category, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug, description, image_url, display_order')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (catErr || !category) {
      throw AppError.notFound(`Category with slug '${slug}' not found`);
    }

    const { data: subcategories, error: subErr } = await supabaseAdmin
      .from('subcategories')
      .select('id, name, slug, description, image_url, display_order')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (subErr) {
      logger.warn(`Failed to fetch subcategories for category ${slug}`, { error: subErr.message });
    }

    return {
      ...category,
      subcategories: subcategories || []
    };
  }

  /**
   * List subcategories with optional category filter
   */
  static async listSubcategories({ categoryId, categorySlug } = {}) {
    let query = supabaseAdmin
      .from('subcategories')
      .select(`
        id, category_id, name, slug, description, image_url, display_order,
        category:categories(id, name, slug)
      `)
      .eq('is_active', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to list subcategories', { error: error.message });
      throw AppError.internal('Failed to retrieve subcategories');
    }

    if (categorySlug) {
      return (data || []).filter(sub => sub.category?.slug === categorySlug);
    }

    return data || [];
  }

  /**
   * List all active brands
   */
  static async listBrands() {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, slug, logo_url')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to list brands', { error: error.message });
      throw AppError.internal('Failed to retrieve brands');
    }

    return data || [];
  }

  /**
   * List active sizes
   */
  static async listSizes(query = {}) {
    const categoryType = query?.category_type || query?.categoryType;
    let dbQuery = supabaseAdmin
      .from('sizes')
      .select('id, name, category_type, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (categoryType) {
      dbQuery = dbQuery.eq('category_type', categoryType.toUpperCase());
    }

    const { data, error } = await dbQuery;

    if (error) {
      logger.error('Failed to list sizes', { error: error.message });
      throw AppError.internal('Failed to retrieve sizes');
    }

    return data || [];
  }

  /**
   * List active colors
   */
  static async listColors() {
    const { data, error } = await supabaseAdmin
      .from('colors')
      .select('id, name, hex_code')
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to list colors', { error: error.message });
      throw AppError.internal('Failed to retrieve colors');
    }

    return data || [];
  }

  /**
   * List published products with search, multi-faceted filtering, sorting, and pagination
   */
  static async listProducts({
    page = 1,
    limit = 12,
    search,
    category,
    subcategory,
    brand,
    size,
    color,
    minPrice,
    maxPrice,
    sortBy = 'newest'
  } = {}) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('products')
      .select(`
        id, title, slug, description, base_mrp, base_price, material, tags, created_at,
        category:categories(id, name, slug),
        subcategory:subcategories(id, name, slug),
        brand:brands(id, name, slug, logo_url),
        images:product_images(id, image_url, alt_text, is_primary, display_order),
        variants:product_variants(id, mrp, selling_price, is_active, size:sizes(id, name, category_type), color:colors(id, name, hex_code))
      `, { count: 'exact' })
      .eq('status', 'PUBLISHED');

    if (search && search.trim() !== '') {
      query = query.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
    }

    if (sortBy === 'price-asc') {
      query = query.order('base_price', { ascending: true });
    } else if (sortBy === 'price-desc') {
      query = query.order('base_price', { ascending: false });
    } else if (sortBy === 'name-asc') {
      query = query.order('title', { ascending: true });
    } else if (sortBy === 'name-desc') {
      query = query.order('title', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: rawProducts, count: totalCount, error } = await query;

    if (error) {
      logger.error('Error fetching products', { error: error.message });
      throw AppError.internal('Failed to retrieve products');
    }

    let products = rawProducts || [];

    if (category) {
      products = products.filter(p => p.category?.slug === category || p.category?.id === category);
    }

    if (subcategory) {
      products = products.filter(p => p.subcategory?.slug === subcategory || p.subcategory?.id === subcategory);
    }

    if (brand) {
      products = products.filter(p => p.brand?.slug === brand || p.brand?.id === brand);
    }

    if (size) {
      products = products.filter(p =>
        p.variants?.some(v => v.is_active && (v.size?.name === size || v.size?.id === size))
      );
    }

    if (color) {
      products = products.filter(p =>
        p.variants?.some(v => v.is_active && (v.color?.name?.toLowerCase() === color.toLowerCase() || v.color?.id === color))
      );
    }

    if (minPrice !== undefined) {
      products = products.filter(p => {
        const lowestPrice = Math.min(...(p.variants?.map(v => v.selling_price) || [p.base_price]));
        return lowestPrice >= minPrice;
      });
    }

    if (maxPrice !== undefined) {
      products = products.filter(p => {
        const lowestPrice = Math.min(...(p.variants?.map(v => v.selling_price) || [p.base_price]));
        return lowestPrice <= maxPrice;
      });
    }

    const items = products.map(p => {
      const activeVariants = (p.variants || []).filter(v => v.is_active);
      const minSellingPrice = activeVariants.length > 0
        ? Math.min(...activeVariants.map(v => v.selling_price))
        : p.base_price;
      const minMrp = activeVariants.length > 0
        ? Math.min(...activeVariants.map(v => v.mrp))
        : p.base_mrp;
      const discountPercent = minMrp > minSellingPrice
        ? Math.round(((minMrp - minSellingPrice) / minMrp) * 100)
        : 0;

      const primaryImage = (p.images || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order)[0];

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
        subcategory: p.subcategory ? { id: p.subcategory.id, name: p.subcategory.name, slug: p.subcategory.slug } : null,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null,
        thumbnailUrl: primaryImage?.image_url || null,
        price: {
          mrp: minMrp,
          sellingPrice: minSellingPrice,
          discountPercent
        },
        availableSizes: [...new Set(activeVariants.map(v => v.size?.name).filter(Boolean))],
        availableColors: [...new Set(activeVariants.map(v => v.color?.name).filter(Boolean))],
        tags: p.tags || [],
        createdAt: p.created_at
      };
    });

    const total = totalCount || items.length;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get full product details by slug
   */
  static async getProductBySlug(slug, { includeUnpublished = false } = {}) {
    let query = supabaseAdmin
      .from('products')
      .select(`
        id, title, slug, description, status, base_mrp, base_price, material, care_instructions, tags, is_featured, created_at, updated_at,
        category:categories(id, name, slug),
        subcategory:subcategories(id, name, slug),
        brand:brands(id, name, slug, logo_url),
        images:product_images(id, image_url, alt_text, display_order, is_primary, variant_id),
        variants:product_variants(
          id, sku, barcode, mrp, selling_price, weight_grams, low_stock_threshold, is_active,
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code)
        )
      `)
      .eq('slug', slug);

    if (!includeUnpublished) {
      query = query.eq('status', 'PUBLISHED');
    }

    const { data: product, error } = await query.single();

    if (error || !product) {
      throw AppError.notFound(`Product with slug '${slug}' not found`);
    }

    const sortedImages = (product.images || []).sort(
      (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.display_order - b.display_order
    );

    const variants = (product.variants || []).filter(v => includeUnpublished || v.is_active);

    const lowestSellingPrice = variants.length > 0
      ? Math.min(...variants.map(v => v.selling_price))
      : product.base_price;
    const lowestMrp = variants.length > 0
      ? Math.min(...variants.map(v => v.mrp))
      : product.base_mrp;
    const discountPercent = lowestMrp > lowestSellingPrice
      ? Math.round(((lowestMrp - lowestSellingPrice) / lowestMrp) * 100)
      : 0;

    // Fetch aggregated stock for variants to determine safe public availability
    const variantIds = variants.map(v => v.id);
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

    const variantsWithAvailability = variants.map(v => {
      const totalAvailable = stockMap[v.id] || 0;
      const threshold = v.low_stock_threshold ?? 5;
      let availability = 'OUT_OF_STOCK';
      if (totalAvailable > threshold) {
        availability = 'IN_STOCK';
      } else if (totalAvailable > 0) {
        availability = 'LOW_STOCK';
      }

      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        mrp: v.mrp,
        sellingPrice: v.selling_price,
        weightGrams: v.weight_grams,
        isActive: v.is_active,
        availability,
        availableStock: totalAvailable,
        quantityAvailable: totalAvailable,
        size: v.size,
        color: v.color
      };
    });

    const isAnyVariantInStock = variantsWithAvailability.some(v => v.availability !== 'OUT_OF_STOCK');

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      status: product.status,
      material: product.material,
      careInstructions: product.care_instructions,
      tags: product.tags || [],
      isFeatured: product.is_featured,
      availability: isAnyVariantInStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
      price: {
        baseMrp: product.base_mrp,
        basePrice: product.base_price,
        lowestMrp,
        lowestSellingPrice,
        discountPercent
      },
      category: product.category,
      subcategory: product.subcategory,
      brand: product.brand,
      images: sortedImages.map(img => ({
        id: img.id,
        imageUrl: img.image_url,
        altText: img.alt_text,
        isPrimary: img.is_primary,
        displayOrder: img.display_order,
        variantId: img.variant_id
      })),
      variants: variantsWithAvailability,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
  }

  /**
   * Get variants of a specific product
   */
  static async getProductVariants(productId) {
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id, product_id, sku, barcode, mrp, selling_price, weight_grams, low_stock_threshold, is_active,
        size:sizes(id, name, category_type),
        color:colors(id, name, hex_code)
      `)
      .eq('product_id', productId)
      .eq('is_active', true);

    if (error) {
      logger.error(`Failed to fetch variants for product ${productId}`, { error: error.message });
      throw AppError.internal('Failed to retrieve product variants');
    }

    const variants = data || [];
    const variantIds = variants.map(v => v.id);
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

    return variants.map(v => {
      const totalAvailable = stockMap[v.id] || 0;
      const threshold = v.low_stock_threshold ?? 5;
      let availability = 'OUT_OF_STOCK';
      if (totalAvailable > threshold) {
        availability = 'IN_STOCK';
      } else if (totalAvailable > 0) {
        availability = 'LOW_STOCK';
      }

      return {
        ...v,
        availableStock: totalAvailable,
        quantityAvailable: totalAvailable,
        availability
      };
    });
  }

  /**
   * Get images of a specific product
   */
  static async getProductImages(productId) {
    const { data, error } = await supabaseAdmin
      .from('product_images')
      .select('id, product_id, variant_id, image_url, alt_text, display_order, is_primary, created_at')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) {
      logger.error(`Failed to fetch images for product ${productId}`, { error: error.message });
      throw AppError.internal('Failed to retrieve product images');
    }

    return data || [];
  }

  // ============================================================================
  // ADMIN CATALOG MANAGEMENT METHODS (WITH SCOPED USER CLIENT)
  // ============================================================================

  /**
   * Create a new product
   */
  static async createProduct(data, userId, token) {
    const client = this.getClient(token);
    const {
      title,
      slug,
      description,
      categoryId,
      subcategoryId,
      brandId,
      status = 'DRAFT',
      baseMrp,
      basePrice,
      material,
      careInstructions,
      tags = [],
      isFeatured = false
    } = data;

    // Verify subcategory exists and belongs to categoryId
    const { data: validSub, error: subErr } = await supabaseAdmin
      .from('subcategories')
      .select('id, category_id, is_active')
      .eq('id', subcategoryId)
      .eq('category_id', categoryId)
      .maybeSingle();

    if (subErr || !validSub) {
      throw AppError.badRequest('Selected subcategory does not belong to the selected category');
    }

    const { data: product, error } = await client
      .from('products')
      .insert({
        title,
        slug,
        description,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        brand_id: brandId || null,
        status,
        base_mrp: baseMrp,
        base_price: basePrice !== undefined ? basePrice : baseMrp,
        material: material || null,
        care_instructions: careInstructions || null,
        tags: tags || [],
        is_featured: isFeatured,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw AppError.conflict(`Product with slug '${slug}' already exists`);
      }
      logger.error('Failed to create product', { error: error.message });
      throw AppError.badRequest(error.message || 'Failed to create product');
    }

    return product;
  }

  /**
   * Update product details with category/subcategory validation
   */
  static async updateProduct(id, data, token) {
    const client = this.getClient(token);

    // Validate Category-Subcategory relation if either is modified
    if (data.subcategoryId || data.categoryId) {
      let targetCatId = data.categoryId;
      let targetSubId = data.subcategoryId;

      if (!targetCatId || !targetSubId) {
        const { data: currentProduct } = await supabaseAdmin
          .from('products')
          .select('category_id, subcategory_id')
          .eq('id', id)
          .single();

        if (currentProduct) {
          targetCatId = targetCatId || currentProduct.category_id;
          targetSubId = targetSubId || currentProduct.subcategory_id;
        }
      }

      if (targetCatId && targetSubId) {
        const { data: validSub } = await supabaseAdmin
          .from('subcategories')
          .select('id')
          .eq('id', targetSubId)
          .eq('category_id', targetCatId)
          .maybeSingle();

        if (!validSub) {
          throw AppError.badRequest('Selected subcategory does not belong to the selected category');
        }
      }
    }

    const updatePayload = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
    if (data.subcategoryId !== undefined) updatePayload.subcategory_id = data.subcategoryId;
    if (data.brandId !== undefined) updatePayload.brand_id = data.brandId;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.baseMrp !== undefined) updatePayload.base_mrp = data.baseMrp;
    if (data.basePrice !== undefined) updatePayload.base_price = data.basePrice;
    if (data.material !== undefined) updatePayload.material = data.material;
    if (data.careInstructions !== undefined) updatePayload.care_instructions = data.careInstructions;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.isFeatured !== undefined) updatePayload.is_featured = data.isFeatured;

    const { data: updated, error } = await client
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        throw AppError.conflict(`Slug conflict: '${data.slug}' is already in use`);
      }
      throw AppError.notFound(`Product with ID '${id}' not found`);
    }

    return updated;
  }

  /**
   * Archive a product
   */
  static async archiveProduct(id, token) {
    const client = this.getClient(token);
    const { data: archived, error } = await client
      .from('products')
      .update({ status: 'ARCHIVED' })
      .eq('id', id)
      .select()
      .single();

    if (error || !archived) {
      throw AppError.notFound(`Product with ID '${id}' not found`);
    }

    return archived;
  }

  /**
   * Create a product variant
   */
  static async createVariant(productId, data, token) {
    const client = this.getClient(token);
    const {
      sizeId,
      colorId,
      sku,
      barcode,
      mrp,
      sellingPrice,
      weightGrams = 300,
      lowStockThreshold = 5,
      initialStock = 0,
      stockStoreId = null
    } = data;

    // 1. Validate initialStock if provided
    const parsedInitialStock = parseInt(initialStock, 10);
    if (initialStock !== undefined && initialStock !== null && (isNaN(parsedInitialStock) || parsedInitialStock < 0 || !Number.isInteger(Number(initialStock)))) {
      throw AppError.badRequest('Initial stock must be a non-negative integer');
    }

    // 2. Load the product & verify existence
    const { data: product, error: prodErr } = await client
      .from('products')
      .select('id, category_id, categories:category_id ( id, name, slug )')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      throw AppError.notFound(`Product with ID '${productId}' not found`);
    }

    // 3. Load the selected size & verify existence
    const { data: size, error: sizeErr } = await client
      .from('sizes')
      .select('id, name, category_type')
      .eq('id', sizeId)
      .single();

    if (sizeErr || !size) {
      throw AppError.badRequest(`Size with ID '${sizeId}' not found`);
    }

    // 4. Determine expected category_type and validate compatibility
    const categorySlug = product.categories?.slug?.toLowerCase() || '';
    const categoryName = product.categories?.name?.toLowerCase() || '';
    const isFootwear = categorySlug === 'footwear' || categoryName === 'footwear';
    const expectedCategoryType = isFootwear ? 'FOOTWEAR' : 'APPAREL';

    if (size.category_type !== expectedCategoryType) {
      throw AppError.badRequest('Selected size is not valid for this product category.');
    }

    // 5. Load the selected color & verify existence
    const { data: color, error: colorErr } = await client
      .from('colors')
      .select('id, name, hex_code')
      .eq('id', colorId)
      .single();

    if (colorErr || !color) {
      throw AppError.badRequest(`Color with ID '${colorId}' not found`);
    }

    // 6. If initialStock > 0, validate store
    let targetStore = null;
    if (parsedInitialStock > 0) {
      if (!stockStoreId) {
        throw AppError.badRequest('Stock store must be selected when initial stock is greater than 0');
      }

      const { data: store, error: storeErr } = await supabaseAdmin
        .from('stores')
        .select('id, name, code, is_active')
        .eq('id', stockStoreId)
        .single();

      if (storeErr || !store) {
        throw AppError.badRequest('Invalid store specified for initial stock');
      }

      if (!store.is_active) {
        throw AppError.badRequest('Selected store is inactive and cannot receive stock');
      }

      targetStore = store;
    }

    // 7. Insert the variant record
    const { data: variant, error } = await client
      .from('product_variants')
      .insert({
        product_id: productId,
        size_id: sizeId,
        color_id: colorId,
        sku,
        barcode,
        mrp,
        selling_price: sellingPrice,
        weight_grams: weightGrams,
        low_stock_threshold: lowStockThreshold
      })
      .select(`
        id, product_id, sku, barcode, mrp, selling_price, weight_grams, low_stock_threshold, is_active,
        size:sizes(id, name, category_type),
        color:colors(id, name, hex_code)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw AppError.conflict(`Variant with SKU '${sku}', barcode, or size/color combination already exists`);
      }
      throw AppError.badRequest(error.message || 'Failed to create variant');
    }

    // 8. If initialStock > 0, create inventory_items and stock_movements ledger entry
    if (parsedInitialStock > 0 && targetStore) {
      try {
        const { data: inventoryItem, error: invErr } = await supabaseAdmin
          .from('inventory_items')
          .insert({
            store_id: targetStore.id,
            variant_id: variant.id,
            quantity_available: parsedInitialStock,
            quantity_reserved: 0,
            quantity_damaged: 0
          })
          .select()
          .single();

        if (invErr || !inventoryItem) {
          logger.error('Failed to create inventory_items for new variant', { error: invErr?.message });
          // Cleanup newly created variant to ensure atomicity
          await supabaseAdmin.from('product_variants').delete().eq('id', variant.id);
          throw AppError.internal('Failed to initialize inventory for the new variant');
        }

        const { error: moveErr } = await supabaseAdmin
          .from('stock_movements')
          .insert({
            variant_id: variant.id,
            source_store_id: targetStore.id,
            destination_store_id: null,
            movement_type: 'PURCHASE_RECEIPT',
            quantity: parsedInitialStock,
            reference_type: 'INITIAL_STOCK',
            reason: 'Initial stock receipt'
          });

        if (moveErr) {
          logger.warn('Failed to record stock movement for initial stock', { error: moveErr.message });
        }
      } catch (err) {
        // Rollback variant if inventory creation threw
        await supabaseAdmin.from('product_variants').delete().eq('id', variant.id);
        throw err;
      }
    }

    const availableStock = parsedInitialStock || 0;
    const threshold = variant.low_stock_threshold ?? 5;
    let availability = 'OUT_OF_STOCK';
    if (availableStock > threshold) {
      availability = 'IN_STOCK';
    } else if (availableStock > 0) {
      availability = 'LOW_STOCK';
    }

    return {
      ...variant,
      availableStock,
      quantityAvailable: availableStock,
      availability
    };
  }

  /**
   * Update a product variant
   */
  static async updateVariant(id, data, token) {
    const client = this.getClient(token);
    const updatePayload = {};
    if (data.sku !== undefined) updatePayload.sku = data.sku;
    if (data.barcode !== undefined) updatePayload.barcode = data.barcode;
    if (data.mrp !== undefined) updatePayload.mrp = data.mrp;
    if (data.sellingPrice !== undefined) updatePayload.selling_price = data.sellingPrice;
    if (data.weightGrams !== undefined) updatePayload.weight_grams = data.weightGrams;
    if (data.lowStockThreshold !== undefined) updatePayload.low_stock_threshold = data.lowStockThreshold;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

    const { data: updated, error } = await client
      .from('product_variants')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        throw AppError.conflict(`SKU '${data.sku}' already exists`);
      }
      throw AppError.notFound(`Variant with ID '${id}' not found`);
    }

    return updated;
  }

  /**
   * Create a product image metadata record
   */
  static async createImage(productId, data, token) {
    const client = this.getClient(token);
    const { variantId, imageUrl, altText, displayOrder = 0, isPrimary = false } = data;

    if (isPrimary) {
      // Set all other images for this product to not primary
      const { error: unsetErr } = await client
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);
      if (unsetErr) {
        logger.error(`Failed to unset other primary images: ${unsetErr.message}`);
      }
    }

    const { data: image, error } = await client
      .from('product_images')
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        image_url: imageUrl,
        alt_text: altText || null,
        display_order: displayOrder,
        is_primary: isPrimary
      })
      .select()
      .single();

    if (error) {
      throw AppError.badRequest(error.message || 'Failed to save product image record');
    }

    return image;
  }

  /**
   * Reorder product images
   */
  static async reorderImages(productId, imageOrders, token) {
    const client = this.getClient(token);

    // Verify all image IDs belong to this product
    const imageIds = imageOrders.map(io => io.imageId);
    const { data: existingImages, error: checkErr } = await client
      .from('product_images')
      .select('id, product_id')
      .in('id', imageIds);

    if (checkErr) {
      throw AppError.badRequest(`Failed to check existing images: ${checkErr.message}`);
    }

    const allBelong = existingImages.every(img => img.product_id === productId);
    if (!allBelong || existingImages.length !== imageIds.length) {
      throw AppError.badRequest('One or more image IDs do not belong to the specified product');
    }

    // Perform updates sequentially
    for (const io of imageOrders) {
      const { error: updateErr } = await client
        .from('product_images')
        .update({ display_order: io.displayOrder })
        .eq('id', io.imageId);

      if (updateErr) {
        throw AppError.badRequest(`Failed to update display order for image ${io.imageId}: ${updateErr.message}`);
      }
    }

    return { message: 'Product images reordered successfully' };
  }

  /**
   * Set a specific product image as primary
   */
  static async setPrimaryImage(imageId, token) {
    const client = this.getClient(token);

    // Fetch the image to locate product_id
    const { data: image, error: fetchErr } = await client
      .from('product_images')
      .select('id, product_id')
      .eq('id', imageId)
      .single();

    if (fetchErr || !image) {
      throw AppError.notFound(`Product image record with ID '${imageId}' not found`);
    }

    const productId = image.product_id;

    // Unset primary for all other images of this product
    const { error: unsetErr } = await client
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId);

    if (unsetErr) {
      throw AppError.badRequest(`Failed to unset other primary images: ${unsetErr.message}`);
    }

    // Set the chosen image as primary
    const { data: updatedImage, error: setErr } = await client
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .select()
      .single();

    if (setErr) {
      throw AppError.badRequest(`Failed to set image as primary: ${setErr.message}`);
    }

    return updatedImage;
  }

  /**
   * Delete a product image metadata record and its storage object
   */
  static async deleteImage(imageId, token) {
    const client = this.getClient(token);

    // Fetch the image metadata first to locate image_url
    const { data: image, error: fetchErr } = await client
      .from('product_images')
      .select('id, image_url, product_id')
      .eq('id', imageId)
      .single();

    if (fetchErr || !image) {
      throw AppError.notFound(`Image with ID '${imageId}' not found`);
    }

    // Delete database record first (source of truth)
    const { error: deleteDbErr } = await client
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (deleteDbErr) {
      throw AppError.badRequest(`Failed to delete database image record: ${deleteDbErr.message}`);
    }

    // Try to delete the Supabase Storage object if it starts with the bucket's base URL
    const imageUrl = image.image_url;
    const bucketMarker = '/public/menx-product-images/';
    const markerIndex = imageUrl.indexOf(bucketMarker);
    if (markerIndex !== -1) {
      const storagePath = imageUrl.substring(markerIndex + bucketMarker.length);
      try {
        const bucketName = env.IMAGE_BUCKET_NAME || 'menx-product-images';
        const { error: deleteStorageErr } = await supabaseAdmin.storage
          .from(bucketName)
          .remove([storagePath]);
        if (deleteStorageErr) {
          logger.warn(`Database record deleted, but failed to delete storage object '${storagePath}': ${deleteStorageErr.message}`);
        }
      } catch (storageErr) {
        logger.warn(`Database record deleted, but unexpected error removing storage object '${storagePath}': ${storageErr.message}`);
      }
    }

    return { message: 'Image deleted successfully' };
  }

  /**
   * Create a new category
   */
  static async createCategory(data, token) {
    const client = this.getClient(token);
    const { name, slug, description, imageUrl, displayOrder = 0 } = data;

    const { data: category, error } = await client
      .from('categories')
      .insert({
        name,
        slug,
        description: description || null,
        image_url: imageUrl || null,
        display_order: displayOrder
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw AppError.conflict(`Category with slug '${slug}' already exists`);
      }
      throw AppError.badRequest(error.message || 'Failed to create category');
    }

    return category;
  }

  /**
   * Update category
   */
  static async updateCategory(id, data, token) {
    const client = this.getClient(token);
    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.imageUrl !== undefined) updatePayload.image_url = data.imageUrl;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;
    if (data.displayOrder !== undefined) updatePayload.display_order = data.displayOrder;

    const { data: updated, error } = await client
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        throw AppError.conflict(`Category slug '${data.slug}' is already in use`);
      }
      throw AppError.notFound(`Category with ID '${id}' not found`);
    }

    return updated;
  }

  /**
   * Create a new subcategory
   */
  static async createSubcategory(data, token) {
    const client = this.getClient(token);
    const { categoryId, name, slug, description, imageUrl, displayOrder = 0 } = data;

    const { data: subcategory, error } = await client
      .from('subcategories')
      .insert({
        category_id: categoryId,
        name,
        slug,
        description: description || null,
        image_url: imageUrl || null,
        display_order: displayOrder
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw AppError.conflict(`Subcategory with slug '${slug}' already exists`);
      }
      throw AppError.badRequest(error.message || 'Failed to create subcategory');
    }

    return subcategory;
  }

  /**
   * Update subcategory
   */
  static async updateSubcategory(id, data, token) {
    const client = this.getClient(token);
    const updatePayload = {};
    if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.imageUrl !== undefined) updatePayload.image_url = data.imageUrl;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;
    if (data.displayOrder !== undefined) updatePayload.display_order = data.displayOrder;

    const { data: updated, error } = await client
      .from('subcategories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        throw AppError.conflict(`Subcategory slug '${data.slug}' is already in use`);
      }
      throw AppError.notFound(`Subcategory with ID '${id}' not found`);
    }

    return updated;
  }

  /**
   * Create a new brand
   */
  static async createBrand(data, token) {
    const client = this.getClient(token);
    const { name, slug, logoUrl } = data;

    const { data: brand, error } = await client
      .from('brands')
      .insert({
        name,
        slug,
        logo_url: logoUrl || null
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw AppError.conflict(`Brand with slug '${slug}' already exists`);
      }
      throw AppError.badRequest(error.message || 'Failed to create brand');
    }

    return brand;
  }

  /**
   * Update brand
   */
  static async updateBrand(id, data, token) {
    const client = this.getClient(token);
    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.logoUrl !== undefined) updatePayload.logo_url = data.logoUrl;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

    const { data: updated, error } = await client
      .from('brands')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      if (error?.code === '23505') {
        throw AppError.conflict(`Brand slug '${data.slug}' is already in use`);
      }
      throw AppError.notFound(`Brand with ID '${id}' not found`);
    }

    return updated;
  }

  /**
   * Helper function to clean up physical storage files after DB transaction commit
   */
  static async cleanupStorageImages(imageUrls, contextLabel = '') {
    if (!imageUrls || imageUrls.length === 0) return;
    try {
      const bucketName = env.IMAGE_BUCKET_NAME || 'menx-product-images';
      const bucketMarker = '/public/menx-product-images/';
      const paths = [];
      for (const imgUrl of imageUrls) {
        if (imgUrl) {
          const markerIndex = imgUrl.indexOf(bucketMarker);
          if (markerIndex !== -1) {
            paths.push(imgUrl.substring(markerIndex + bucketMarker.length));
          }
        }
      }
      if (paths.length > 0) {
        const { error: storageDelErr } = await supabaseAdmin.storage.from(bucketName).remove(paths);
        if (storageDelErr) {
          logger.warn(`Storage file removal encountered warning for ${contextLabel}:`, { error: storageDelErr.message, paths });
        } else {
          logger.info(`Cleaned up ${paths.length} storage image files for ${contextLabel}`);
        }
      }
    } catch (storageErr) {
      logger.warn(`Storage file removal exception for ${contextLabel}:`, { error: storageErr.message });
    }
  }

  /**
   * Permanently hard-delete a product and its dependent catalogue records in an atomic transaction
   */
  static async deleteProduct(id, user = null, token = null, reqInfo = {}) {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured for atomic transactions');
    }

    const client = await pool.connect();
    let storageImageUrls = [];
    let productDetails = null;

    try {
      await client.query('BEGIN');

      // 1. Fetch product under write lock
      const prodRes = await client.query(
        `SELECT id, title, slug, description, status, category_id, subcategory_id, brand_id, base_mrp, base_price, created_at 
         FROM products 
         WHERE id = $1 
         FOR UPDATE`,
        [id]
      );

      if (prodRes.rows.length === 0) {
        throw AppError.notFound(`Product with ID '${id}' not found`);
      }
      const product = prodRes.rows[0];
      productDetails = product;

      // 2. Fetch all variants
      const varRes = await client.query(
        `SELECT id, sku FROM product_variants WHERE product_id = $1`,
        [id]
      );
      const variantIds = varRes.rows.map(v => v.id);

      // 3. Collect image URLs
      const imgRes = await client.query(
        `SELECT image_url FROM product_images WHERE product_id = $1`,
        [id]
      );
      storageImageUrls = imgRes.rows.map(r => r.image_url).filter(Boolean);

      // 4. Delete dependent catalogue records
      await client.query(`DELETE FROM outfit_items WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM wishlist_items WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM reviews WHERE product_id = $1`, [id]);

      if (variantIds.length > 0) {
        await client.query(`DELETE FROM cart_items WHERE variant_id = ANY($1)`, [variantIds]);
        
        // Nullify historical transaction references
        await client.query(`UPDATE return_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`UPDATE return_items SET replacement_variant_id = NULL WHERE replacement_variant_id = ANY($1)`, [variantIds]);
        await client.query(`UPDATE order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`UPDATE purchase_order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
        
        // Delete inventory and stock movements
        await client.query(`DELETE FROM stock_movements WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM inventory_items WHERE variant_id = ANY($1)`, [variantIds]);
      }

      await client.query(`DELETE FROM product_images WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM product_variants WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM products WHERE id = $1`, [id]);

      // 5. Audit log inside the transaction BEFORE commit
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_entity, target_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user?.id || null,
          user?.role || 'SUPER_ADMIN',
          'DELETE_PRODUCT',
          'products',
          id,
          JSON.stringify({
            id: product.id,
            title: product.title,
            slug: product.slug,
            status: product.status,
            category_id: product.category_id,
            subcategory_id: product.subcategory_id,
            brand_id: product.brand_id,
            deletedVariantCount: variantIds.length,
            deletedImageCount: storageImageUrls.length
          }),
          null,
          reqInfo.ip || null,
          reqInfo.userAgent || null
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[DELETE_PRODUCT_TRANSACTION_FAILED] Failed to delete product ${id}:`, err);
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to delete product: ${err.message}`);
    } finally {
      client.release();
    }

    // 6. After commit: Storage cleanup (never aborts or rolls back the DB)
    await CatalogService.cleanupStorageImages(storageImageUrls, `product ${id}`);

    logger.info(`Product '${productDetails.title}' (${productDetails.slug}, ID: ${id}) permanently hard-deleted by user ${user?.id || 'system'}`);

    return {
      message: 'Product permanently deleted successfully',
      id,
      title: productDetails.title,
      slug: productDetails.slug
    };
  }

  /**
   * Permanently hard-delete a category and ALL its dependent catalogue data in an atomic transaction
   */
  static async deleteCategory(id, user = null, token = null, reqInfo = {}) {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured for atomic transactions');
    }

    const client = await pool.connect();
    let storageImageUrls = [];
    let categoryDetails = null;

    try {
      await client.query('BEGIN');

      // 1. Fetch category under write lock
      const catRes = await client.query(
        `SELECT id, name, slug, description, display_order, is_active FROM categories WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (catRes.rows.length === 0) {
        throw AppError.notFound(`Category with ID '${id}' not found`);
      }
      const category = catRes.rows[0];
      categoryDetails = category;

      // 2. Find all subcategories under this category
      const subRes = await client.query(
        `SELECT id, name, slug FROM subcategories WHERE category_id = $1`,
        [id]
      );
      const subcategoryIds = subRes.rows.map(s => s.id);

      // 3. Find all products directly in this category OR under its subcategories
      let prodRes;
      if (subcategoryIds.length > 0) {
        prodRes = await client.query(
          `SELECT id, title, slug FROM products WHERE category_id = $1 OR subcategory_id = ANY($2)`,
          [id, subcategoryIds]
        );
      } else {
        prodRes = await client.query(
          `SELECT id, title, slug FROM products WHERE category_id = $1`,
          [id]
        );
      }
      const productIds = prodRes.rows.map(p => p.id);

      let variantIds = [];
      if (productIds.length > 0) {
        // 4. Find all variants for these products
        const varRes = await client.query(
          `SELECT id, sku FROM product_variants WHERE product_id = ANY($1)`,
          [productIds]
        );
        variantIds = varRes.rows.map(v => v.id);

        // 5. Collect product image URLs
        const imgRes = await client.query(
          `SELECT image_url FROM product_images WHERE product_id = ANY($1)`,
          [productIds]
        );
        storageImageUrls = imgRes.rows.map(r => r.image_url).filter(Boolean);

        // 6. Delete catalogue-owned dependents for these products
        await client.query(`DELETE FROM outfit_items WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM wishlist_items WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM reviews WHERE product_id = ANY($1)`, [productIds]);

        if (variantIds.length > 0) {
          await client.query(`DELETE FROM cart_items WHERE variant_id = ANY($1)`, [variantIds]);

          // Nullify historical transaction references
          await client.query(`UPDATE return_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE return_items SET replacement_variant_id = NULL WHERE replacement_variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE purchase_order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);

          // Delete inventory and stock movements
          await client.query(`DELETE FROM stock_movements WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`DELETE FROM inventory_items WHERE variant_id = ANY($1)`, [variantIds]);
        }

        await client.query(`DELETE FROM product_images WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM product_variants WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM products WHERE id = ANY($1)`, [productIds]);
      }

      // 7. Delete subcategories
      if (subcategoryIds.length > 0) {
        await client.query(`DELETE FROM subcategories WHERE category_id = $1`, [id]);
      }

      // 8. Delete category
      await client.query(`DELETE FROM categories WHERE id = $1`, [id]);

      // 9. Insert audit log inside the transaction BEFORE commit
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_entity, target_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user?.id || null,
          user?.role || 'SUPER_ADMIN',
          'DELETE_CATEGORY',
          'categories',
          id,
          JSON.stringify({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            deletedSubcategoryCount: subcategoryIds.length,
            deletedProductCount: productIds.length,
            deletedVariantCount: variantIds.length,
            deletedImageCount: storageImageUrls.length
          }),
          null,
          reqInfo.ip || null,
          reqInfo.userAgent || null
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[DELETE_CATEGORY_TRANSACTION_FAILED] Failed to delete category ${id}:`, err);
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to delete category: ${err.message}`);
    } finally {
      client.release();
    }

    // 10. After commit: Storage cleanup
    await CatalogService.cleanupStorageImages(storageImageUrls, `category ${id}`);

    logger.info(`Category '${categoryDetails.name}' (${categoryDetails.slug}, ID: ${id}) permanently hard-deleted by user ${user?.id || 'system'}`);

    return {
      message: 'Category permanently deleted successfully',
      id,
      name: categoryDetails.name,
      slug: categoryDetails.slug
    };
  }

  /**
   * Permanently hard-delete a subcategory and its products in an atomic transaction
   */
  static async deleteSubcategory(id, user = null, token = null, reqInfo = {}) {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured for atomic transactions');
    }

    const client = await pool.connect();
    let storageImageUrls = [];
    let subcategoryDetails = null;

    try {
      await client.query('BEGIN');

      // 1. Fetch subcategory under write lock
      const subRes = await client.query(
        `SELECT id, name, slug, category_id FROM subcategories WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (subRes.rows.length === 0) {
        throw AppError.notFound(`Subcategory with ID '${id}' not found`);
      }
      const subcategory = subRes.rows[0];
      subcategoryDetails = subcategory;

      // 2. Find all products under this subcategory
      const prodRes = await client.query(
        `SELECT id, title, slug FROM products WHERE subcategory_id = $1`,
        [id]
      );
      const productIds = prodRes.rows.map(p => p.id);

      let variantIds = [];
      if (productIds.length > 0) {
        const varRes = await client.query(
          `SELECT id, sku FROM product_variants WHERE product_id = ANY($1)`,
          [productIds]
        );
        variantIds = varRes.rows.map(v => v.id);

        const imgRes = await client.query(
          `SELECT image_url FROM product_images WHERE product_id = ANY($1)`,
          [productIds]
        );
        storageImageUrls = imgRes.rows.map(r => r.image_url).filter(Boolean);

        await client.query(`DELETE FROM outfit_items WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM wishlist_items WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM reviews WHERE product_id = ANY($1)`, [productIds]);

        if (variantIds.length > 0) {
          await client.query(`DELETE FROM cart_items WHERE variant_id = ANY($1)`, [variantIds]);

          // Nullify historical transaction references
          await client.query(`UPDATE return_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE return_items SET replacement_variant_id = NULL WHERE replacement_variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`UPDATE purchase_order_items SET variant_id = NULL WHERE variant_id = ANY($1)`, [variantIds]);

          await client.query(`DELETE FROM stock_movements WHERE variant_id = ANY($1)`, [variantIds]);
          await client.query(`DELETE FROM inventory_items WHERE variant_id = ANY($1)`, [variantIds]);
        }

        await client.query(`DELETE FROM product_images WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM product_variants WHERE product_id = ANY($1)`, [productIds]);
        await client.query(`DELETE FROM products WHERE id = ANY($1)`, [productIds]);
      }

      await client.query(`DELETE FROM subcategories WHERE id = $1`, [id]);

      // Audit log inside transaction
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_entity, target_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user?.id || null,
          user?.role || 'SUPER_ADMIN',
          'DELETE_SUBCATEGORY',
          'subcategories',
          id,
          JSON.stringify({
            id: subcategory.id,
            name: subcategory.name,
            slug: subcategory.slug,
            category_id: subcategory.category_id,
            deletedProductCount: productIds.length,
            deletedVariantCount: variantIds.length,
            deletedImageCount: storageImageUrls.length
          }),
          null,
          reqInfo.ip || null,
          reqInfo.userAgent || null
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[DELETE_SUBCATEGORY_TRANSACTION_FAILED] Failed to delete subcategory ${id}:`, err);
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to delete subcategory: ${err.message}`);
    } finally {
      client.release();
    }

    await CatalogService.cleanupStorageImages(storageImageUrls, `subcategory ${id}`);

    logger.info(`Subcategory '${subcategoryDetails.name}' (${subcategoryDetails.slug}, ID: ${id}) permanently hard-deleted by user ${user?.id || 'system'}`);

    return {
      message: 'Subcategory deleted successfully',
      id,
      name: subcategoryDetails.name,
      slug: subcategoryDetails.slug
    };
  }
}
