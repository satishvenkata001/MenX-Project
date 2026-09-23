import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

/**
 * Authoritative stock warning status evaluator.
 * Consistent across variant lists and low-stock warning dashboards.
 */
export function getStockWarningStatus(availableStock, minThreshold = 5) {
  const stock = Number(availableStock ?? 0);
  const threshold = Number(minThreshold ?? 5);

  if (stock <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      warningType: 'OOS',
      label: 'OUT OF STOCK',
      requiresAttention: true,
      severityRatio: 0
    };
  }

  if (stock <= threshold) {
    return {
      status: 'LOW_STOCK',
      warningType: 'LOW',
      label: 'LOW STOCK',
      requiresAttention: true,
      severityRatio: threshold > 0 ? (stock / threshold) : 1
    };
  }

  return {
    status: 'IN_STOCK',
    warningType: 'HEALTHY',
    label: 'IN STOCK',
    requiresAttention: false,
    severityRatio: threshold > 0 ? (stock / threshold) : 1
  };
}

export class InventoryService {
  static getStockWarningStatus = getStockWarningStatus;
  /**
   * List inventory items with pagination, filtering, and stock status
   */
  static async listInventory({
    page = 1,
    limit = 20,
    variantId,
    sku,
    lowStockOnly = false,
    search
  } = {}) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('inventory_items')
      .select(`
        id, variant_id, quantity_available, quantity_reserved, quantity_damaged, updated_at,
        variant:product_variants(
          id, sku, barcode, mrp, selling_price, low_stock_threshold, is_active,
          product:products(id, title, slug),
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code)
        )
      `, { count: 'exact' });

    if (variantId) {
      query = query.eq('variant_id', variantId);
    }

    query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: rawItems, count: totalCount, error } = await query;

    if (error) {
      logger.error('Failed to query inventory items', { error: error.message });
      throw AppError.internal('Failed to retrieve inventory items');
    }

    let items = (rawItems || []).map(item => {
      const threshold = item.variant?.low_stock_threshold ?? 5;
      let status = 'IN_STOCK';
      if (item.quantity_available === 0) {
        status = 'OUT_OF_STOCK';
      } else if (item.quantity_available <= threshold) {
        status = 'LOW_STOCK';
      }

      return {
        id: item.id,
        variantId: item.variant_id,
        variant: item.variant,
        stock: {
          available: item.quantity_available,
          reserved: item.quantity_reserved,
          damaged: item.quantity_damaged,
          total: item.quantity_available + item.quantity_reserved + item.quantity_damaged,
          threshold,
          status
        },
        updatedAt: item.updated_at
      };
    });

    if (sku) {
      items = items.filter(i => i.variant?.sku?.toLowerCase().includes(sku.toLowerCase()));
    }

    if (search) {
      const term = search.toLowerCase();
      items = items.filter(i =>
        i.variant?.sku?.toLowerCase().includes(term) ||
        i.variant?.product?.title?.toLowerCase().includes(term)
      );
    }

    if (lowStockOnly) {
      items = items.filter(i => i.stock.status === 'LOW_STOCK' || i.stock.status === 'OUT_OF_STOCK');
    }

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
   * Get single inventory item detail by ID
   */
  static async getInventoryById(id) {
    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        id, variant_id, quantity_available, quantity_reserved, quantity_damaged, updated_at,
        variant:product_variants(
          id, sku, barcode, mrp, selling_price, weight_grams, low_stock_threshold, is_active,
          product:products(id, title, slug, description),
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !item) {
      throw AppError.notFound(`Inventory item with ID '${id}' not found`);
    }

    const threshold = item.variant?.low_stock_threshold ?? 5;
    let status = 'IN_STOCK';
    if (item.quantity_available === 0) {
      status = 'OUT_OF_STOCK';
    } else if (item.quantity_available <= threshold) {
      status = 'LOW_STOCK';
    }

    return {
      id: item.id,
      variantId: item.variant_id,
      variant: item.variant,
      stock: {
        available: item.quantity_available,
        reserved: item.quantity_reserved,
        damaged: item.quantity_damaged,
        total: item.quantity_available + item.quantity_reserved + item.quantity_damaged,
        threshold,
        status
      },
      updatedAt: item.updated_at
    };
  }

  /**
   * Get single inventory item detail by Variant ID
   */
  static async getInventoryByVariantId(variantId) {
    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        id, variant_id, quantity_available, quantity_reserved, quantity_damaged, updated_at,
        variant:product_variants(
          id, sku, barcode, mrp, selling_price, weight_grams, low_stock_threshold, is_active,
          product:products(id, title, slug, description),
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code)
        )
      `)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (error) {
      throw AppError.internal('Failed to query variant inventory');
    }

    if (!item) {
      return null;
    }

    const threshold = item.variant?.low_stock_threshold ?? 5;
    let status = 'IN_STOCK';
    if (item.quantity_available === 0) {
      status = 'OUT_OF_STOCK';
    } else if (item.quantity_available <= threshold) {
      status = 'LOW_STOCK';
    }

    return {
      id: item.id,
      variantId: item.variant_id,
      variant: item.variant,
      stock: {
        available: item.quantity_available,
        reserved: item.quantity_reserved,
        damaged: item.quantity_damaged,
        total: item.quantity_available + item.quantity_reserved + item.quantity_damaged,
        threshold,
        status
      },
      updatedAt: item.updated_at
    };
  }

  /**
   * Adjust stock for a variant with full ledger tracking
   */
  static async adjustStock({
    variantId,
    quantity,
    movementType = 'INVENTORY_ADJUSTMENT',
    referenceType = 'MANUAL_ADJUSTMENT',
    referenceId = null,
    reason
  }, actorId) {
    // Validate variant exists & active
    const { data: variant, error: varErr } = await supabaseAdmin
      .from('product_variants')
      .select('id, is_active, sku')
      .eq('id', variantId)
      .single();

    if (varErr || !variant) {
      throw AppError.badRequest('Invalid product variant specified');
    }

    // Fetch existing inventory record or create if not present
    let { data: inventoryItem } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('variant_id', variantId)
      .maybeSingle();

    if (!inventoryItem) {
      // Initialize stock record
      const { data: created, error: createErr } = await supabaseAdmin
        .from('inventory_items')
        .insert({
          variant_id: variantId,
          quantity_available: 0,
          quantity_reserved: 0,
          quantity_damaged: 0
        })
        .select()
        .single();

      if (createErr || !created) {
        throw AppError.internal('Failed to initialize inventory item');
      }
      inventoryItem = created;
    }

    // Calculate new quantities
    let newAvailable = inventoryItem.quantity_available;
    let newDamaged = inventoryItem.quantity_damaged;

    if (movementType === 'DAMAGED_WRITEOFF') {
      const damagedQty = Math.abs(quantity);
      if (newAvailable < damagedQty) {
        throw AppError.badRequest(`Cannot write off ${damagedQty} damaged items. Available stock: ${newAvailable}`);
      }
      newAvailable -= damagedQty;
      newDamaged += damagedQty;
    } else {
      newAvailable += quantity;
      if (newAvailable < 0) {
        throw AppError.badRequest(
          `Adjustment of ${quantity} would result in negative available inventory. Current available: ${inventoryItem.quantity_available}`
        );
      }
    }

    // 1. Update inventory item
    const { data: updatedInventory, error: updateErr } = await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity_available: newAvailable,
        quantity_damaged: newDamaged,
        updated_at: new Date().toISOString()
      })
      .eq('id', inventoryItem.id)
      .select()
      .single();

    if (updateErr || !updatedInventory) {
      logger.error('Failed to update inventory quantity', { error: updateErr?.message });
      throw AppError.badRequest('Failed to update inventory record');
    }

    // 2. Insert immutable stock movement audit ledger entry
    const { data: movement, error: moveErr } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        variant_id: variantId,
        movement_type: movementType,
        quantity: quantity,
        reference_type: referenceType,
        reference_id: referenceId,
        reason: reason,
        performed_by: actorId
      })
      .select()
      .single();

    if (moveErr) {
      logger.error('CRITICAL: Stock movement audit insert failed', { error: moveErr.message });
    }

    return {
      inventory: updatedInventory,
      movement
    };
  }

  /**
   * Atomic inventory reservation for online orders using the PostgreSQL stored procedure
   */
  static async reserveInventory({ variantId, quantity, orderId }, actorId) {
    const { error } = await supabaseAdmin.rpc('reserve_inventory_for_order', {
      p_variant_id: variantId,
      p_quantity: quantity,
      p_order_id: orderId,
      p_performed_by: actorId
    });

    if (error) {
      logger.warn('Inventory reservation failed in database function', { error: error.message });
      throw AppError.badRequest(error.message || 'Failed to reserve inventory: Insufficient stock');
    }

    return {
      reserved: true,
      variantId,
      quantity,
      orderId
    };
  }

  /**
   * List auditable stock movements ledger
   */
  static async listStockMovements({
    page = 1,
    limit = 20,
    variantId,
    movementType,
    referenceType
  } = {}) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        id, variant_id, movement_type, quantity, reference_type, reference_id, reason, created_at,
        variant:product_variants(id, sku, product:products(id, title, slug)),
        performer:profiles!stock_movements_performed_by_fkey(id, first_name, last_name, role)
      `, { count: 'exact' });

    if (variantId) {
      query = query.eq('variant_id', variantId);
    }

    if (movementType) {
      query = query.eq('movement_type', movementType);
    }

    if (referenceType) {
      query = query.eq('reference_type', referenceType);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: movements, count: totalCount, error } = await query;

    if (error) {
      logger.error('Failed to fetch stock movements', { error: error.message });
      throw AppError.internal('Failed to retrieve stock movements');
    }

    const total = totalCount || (movements || []).length;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      movements: movements || [],
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
   * Get low-stock items grouped by parent Product / Catalogue with severity sorting
   */
  static async getLowStockItems({ page = 1, limit = 20, search } = {}) {
    // 1. Fetch all product variants with nested inventory, parent product, size, and color
    const query = supabaseAdmin
      .from('product_variants')
      .select(`
        id, sku, barcode, mrp, selling_price, low_stock_threshold, is_active, updated_at,
        product:products(id, title, slug),
        size:sizes(id, name, category_type),
        color:colors(id, name, hex_code),
        inventory:inventory_items(id, quantity_available, quantity_reserved, quantity_damaged, updated_at)
      `);

    const { data: rawVariants, error } = await query;

    if (error) {
      logger.error('Failed to query product variants and inventory items', { error: error.message });
      throw AppError.internal('Failed to retrieve low stock items');
    }

    // 2. Filter variants strictly meeting the warning condition: available_stock <= min_threshold
    const lowStockVariants = [];
    for (const v of (rawVariants || [])) {
      if (v.is_active === false) continue;
      const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
      const threshold = Number(v.low_stock_threshold ?? 5);
      const available = Number(inv?.quantity_available ?? 0);
      const reserved = Number(inv?.quantity_reserved ?? 0);
      const damaged = Number(inv?.quantity_damaged ?? 0);

      const warning = getStockWarningStatus(available, threshold);

      // Condition: requires stock attention (available <= threshold or available <= 0)
      if (warning.requiresAttention) {
        // Optional search filtering by product title, slug, SKU, barcode, size, color
        if (search && search.trim() !== '') {
          const term = search.trim().toLowerCase();
          const prodTitle = (v.product?.title || '').toLowerCase();
          const prodSlug = (v.product?.slug || '').toLowerCase();
          const skuCode = (v.sku || '').toLowerCase();
          const barcode = (v.barcode || '').toLowerCase();
          const sizeName = (v.size?.name || '').toLowerCase();
          const colorName = (v.color?.name || '').toLowerCase();

          if (
            !prodTitle.includes(term) &&
            !prodSlug.includes(term) &&
            !skuCode.includes(term) &&
            !barcode.includes(term) &&
            !sizeName.includes(term) &&
            !colorName.includes(term)
          ) {
            continue;
          }
        }

        lowStockVariants.push({
          id: inv?.id || v.id,
          variantId: v.id,
          productId: v.product?.id,
          productTitle: v.product?.title,
          sku: v.sku || 'N/A',
          barcode: v.barcode || null,
          size: v.size?.name || (typeof v.size === 'string' ? v.size : 'N/A'),
          color: v.color?.name || (typeof v.color === 'string' ? v.color : 'N/A'),
          sizeDetails: v.size,
          colorDetails: v.color,
          mrp: Number(v.mrp || 0),
          sellingPrice: Number(v.selling_price || 0),
          availableStock: available,
          reservedStock: reserved,
          damagedStock: damaged,
          minThreshold: threshold,
          threshold,
          status: warning.status,
          warningType: warning.warningType,
          label: warning.label,
          severityRatio: warning.severityRatio,
          requiresAttention: true,
          variant: {
            id: v.id,
            sku: v.sku,
            barcode: v.barcode,
            mrp: v.mrp,
            selling_price: v.selling_price,
            low_stock_threshold: threshold,
            is_active: v.is_active,
            product: v.product,
            size: v.size,
            color: v.color
          },
          stock: {
            available,
            reserved,
            damaged,
            total: available + reserved + damaged,
            threshold,
            status: warning.status
          },
          updatedAt: inv?.updated_at || v.updated_at
        });
      }
    }

    // 3. Group affected variants under their parent Product / Catalogue
    const productMap = new Map();
    for (const v of lowStockVariants) {
      const prod = v.variant?.product;
      const prodId = prod?.id || v.productId || 'unknown-product';
      const prodTitle = prod?.title || v.productTitle || 'Unknown Product';
      const prodSlug = prod?.slug || '';

      if (!productMap.has(prodId)) {
        productMap.set(prodId, {
          productId: prodId,
          productTitle: prodTitle,
          productSlug: prodSlug,
          lowStockVariantCount: 0,
          severityRatio: 1,
          hasZeroStock: false,
          hasLowStock: false,
          variants: []
        });
      }

      const group = productMap.get(prodId);
      group.variants.push(v);
      group.lowStockVariantCount = group.variants.length;
      group.severityRatio = Math.min(group.severityRatio, v.severityRatio);
      if (v.availableStock <= 0) group.hasZeroStock = true;
      if (v.availableStock > 0 && v.availableStock <= v.minThreshold) group.hasLowStock = true;
    }

    // 4. Sort variants within each product from most critical to least critical
    for (const group of productMap.values()) {
      group.variants.sort((a, b) => {
        if (a.severityRatio !== b.severityRatio) return a.severityRatio - b.severityRatio;
        if (a.availableStock !== b.availableStock) return a.availableStock - b.availableStock;
        return a.sku.localeCompare(b.sku);
      });
    }

    // 5. Sort products by severity (most critical shortage first)
    const allProducts = Array.from(productMap.values()).sort((a, b) => {
      if (a.severityRatio !== b.severityRatio) return a.severityRatio - b.severityRatio;
      if (b.lowStockVariantCount !== a.lowStockVariantCount) return b.lowStockVariantCount - a.lowStockVariantCount;
      return a.productTitle.localeCompare(b.productTitle);
    });

    const totalProducts = allProducts.length;
    const totalVariants = lowStockVariants.length;

    // 6. Paginate grouped products
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;
    const paginatedProducts = allProducts.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(totalProducts / limitNum) || 1;

    return {
      products: paginatedProducts,
      allProducts,
      items: lowStockVariants,
      totalProducts,
      totalVariants,
      totalLowStockVariants: totalVariants,
      pagination: {
        total: totalProducts,
        totalProducts,
        totalVariants,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };
  }
}
