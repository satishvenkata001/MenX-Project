import { supabaseAdmin } from '../config/supabase.js';
import { USER_ROLES } from '../config/constants.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class InventoryService {
  /**
   * Validates if the authenticated user has authorization to access the specific store
   */
  static async validateStoreAccess(userProfile, storeId) {
    if (!userProfile) {
      throw AppError.unauthorized('Authentication required');
    }

    // SuperAdmin and InventoryManager have global access to all stores
    if (
      userProfile.role === USER_ROLES.SUPER_ADMIN ||
      userProfile.role === USER_ROLES.INVENTORY_MANAGER
    ) {
      return true;
    }

    // StoreManager can only access assigned stores
    if (userProfile.role === USER_ROLES.STORE_MANAGER) {
      const { data: assignment, error } = await supabaseAdmin
        .from('staff_store_assignments')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('store_id', storeId)
        .maybeSingle();

      if (error || !assignment) {
        logger.warn(`Store access denied for StoreManager ${userProfile.id} on store ${storeId}`);
        throw AppError.forbidden('You do not have permission to manage inventory for this store');
      }

      return true;
    }

    throw AppError.forbidden('Unauthorized role for inventory management');
  }

  /**
   * Get assigned store IDs for a user (used for scoping queries for StoreManager)
   */
  static async getAssignedStoreIds(userProfile) {
    if (
      userProfile.role === USER_ROLES.SUPER_ADMIN ||
      userProfile.role === USER_ROLES.INVENTORY_MANAGER
    ) {
      return null; // Global access: No store filtering required
    }

    if (userProfile.role === USER_ROLES.STORE_MANAGER) {
      const { data: assignments, error } = await supabaseAdmin
        .from('staff_store_assignments')
        .select('store_id')
        .eq('user_id', userProfile.id);

      if (error) {
        logger.error('Failed to query staff store assignments', { error: error.message });
        throw AppError.internal('Failed to verify store assignments');
      }

      return (assignments || []).map(a => a.store_id);
    }

    return [];
  }

  /**
   * List all active stores (physical retail shops, central warehouses, fulfillment centers)
   */
  static async listStores() {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('id, name, code, type, address_line1, address_line2, city, state, postal_code, phone, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to list stores', { error: error.message });
      throw AppError.internal('Failed to retrieve stores');
    }

    return data || [];
  }

  /**
   * List inventory items across stores with pagination, filtering, and stock status
   */
  static async listInventory({
    page = 1,
    limit = 20,
    storeId,
    variantId,
    sku,
    lowStockOnly = false,
    search
  } = {}, userProfile) {
    const offset = (page - 1) * limit;
    const permittedStoreIds = await this.getAssignedStoreIds(userProfile);

    // If StoreManager has no assigned stores, return empty list
    if (permittedStoreIds !== null && permittedStoreIds.length === 0) {
      return {
        items: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false }
      };
    }

    let query = supabaseAdmin
      .from('inventory_items')
      .select(`
        id, store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged, updated_at,
        store:stores(id, name, code, type, city, is_active),
        variant:product_variants(
          id, sku, barcode, mrp, selling_price, low_stock_threshold, is_active,
          product:products(id, title, slug),
          size:sizes(id, name, category_type),
          color:colors(id, name, hex_code)
        )
      `, { count: 'exact' });

    // Store scope filter
    if (permittedStoreIds !== null) {
      query = query.in('store_id', permittedStoreIds);
    }

    if (storeId) {
      if (permittedStoreIds !== null && !permittedStoreIds.includes(storeId)) {
        throw AppError.forbidden('You do not have access to this store');
      }
      query = query.eq('store_id', storeId);
    }

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
        store: item.store,
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

    // In-memory filters if needed
    if (sku) {
      items = items.filter(i => i.variant?.sku?.toLowerCase().includes(sku.toLowerCase()));
    }

    if (search) {
      const term = search.toLowerCase();
      items = items.filter(i =>
        i.variant?.sku?.toLowerCase().includes(term) ||
        i.variant?.product?.title?.toLowerCase().includes(term) ||
        i.store?.name?.toLowerCase().includes(term)
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
  static async getInventoryById(id, userProfile) {
    const { data: item, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        id, store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged, updated_at,
        store:stores(id, name, code, type, address_line1, city, state, postal_code, is_active),
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

    await this.validateStoreAccess(userProfile, item.store_id);

    const threshold = item.variant?.low_stock_threshold ?? 5;
    let status = 'IN_STOCK';
    if (item.quantity_available === 0) {
      status = 'OUT_OF_STOCK';
    } else if (item.quantity_available <= threshold) {
      status = 'LOW_STOCK';
    }

    return {
      id: item.id,
      store: item.store,
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
   * Adjust stock for a variant at a specific store with full ledger tracking
   */
  static async adjustStock({
    storeId,
    variantId,
    quantity,
    movementType = 'INVENTORY_ADJUSTMENT',
    referenceType = 'MANUAL_ADJUSTMENT',
    referenceId = null,
    reason
  }, actorId, userProfile) {
    await this.validateStoreAccess(userProfile, storeId);

    // Validate store exists & active
    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('id, is_active')
      .eq('id', storeId)
      .single();

    if (storeErr || !store || !store.is_active) {
      throw AppError.badRequest('Invalid or inactive store specified');
    }

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
    let { data: inventoryItem, error: invErr } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (!inventoryItem) {
      // Initialize stock record
      const { data: created, error: createErr } = await supabaseAdmin
        .from('inventory_items')
        .insert({
          store_id: storeId,
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
        source_store_id: storeId,
        destination_store_id: null,
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
   * Transfer stock atomically between two stores with stock movements ledger
   */
  static async transferStock({
    sourceStoreId,
    destinationStoreId,
    variantId,
    quantity,
    reason
  }, actorId, userProfile) {
    if (sourceStoreId === destinationStoreId) {
      throw AppError.badRequest('Source store and destination store cannot be the same');
    }

    await this.validateStoreAccess(userProfile, sourceStoreId);

    // Validate destination store exists and active
    const { data: destStore, error: destErr } = await supabaseAdmin
      .from('stores')
      .select('id, is_active, name')
      .eq('id', destinationStoreId)
      .single();

    if (destErr || !destStore || !destStore.is_active) {
      throw AppError.badRequest('Invalid or inactive destination store specified');
    }

    // Validate variant exists
    const { data: variant, error: varErr } = await supabaseAdmin
      .from('product_variants')
      .select('id, sku')
      .eq('id', variantId)
      .single();

    if (varErr || !variant) {
      throw AppError.badRequest('Invalid product variant specified');
    }

    // 1. Fetch and validate source stock
    const { data: sourceItem, error: srcErr } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('store_id', sourceStoreId)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (!sourceItem || sourceItem.quantity_available < quantity) {
      const available = sourceItem?.quantity_available || 0;
      throw AppError.badRequest(
        `Insufficient available stock for transfer. Requested: ${quantity}, Available at source: ${available}`
      );
    }

    // 2. Fetch or create destination stock record
    let { data: destItem } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('store_id', destinationStoreId)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (!destItem) {
      const { data: createdDest, error: createDestErr } = await supabaseAdmin
        .from('inventory_items')
        .insert({
          store_id: destinationStoreId,
          variant_id: variantId,
          quantity_available: 0,
          quantity_reserved: 0,
          quantity_damaged: 0
        })
        .select()
        .single();

      if (createDestErr || !createdDest) {
        throw AppError.internal('Failed to initialize destination inventory item');
      }
      destItem = createdDest;
    }

    // 3. Deduct from source store
    const { data: updatedSource, error: srcUpdateErr } = await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity_available: sourceItem.quantity_available - quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceItem.id)
      .select()
      .single();

    if (srcUpdateErr || !updatedSource) {
      throw AppError.badRequest('Failed to deduct stock from source store');
    }

    // 4. Add to destination store
    const { data: updatedDest, error: destUpdateErr } = await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity_available: destItem.quantity_available + quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', destItem.id)
      .select()
      .single();

    if (destUpdateErr || !updatedDest) {
      // Rollback source store deduction
      await supabaseAdmin
        .from('inventory_items')
        .update({ quantity_available: sourceItem.quantity_available })
        .eq('id', sourceItem.id);

      throw AppError.internal('Failed to increment destination store stock. Transfer rolled back.');
    }

    // 5. Record stock movement ledger entry
    const { data: movement, error: moveErr } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        variant_id: variantId,
        source_store_id: sourceStoreId,
        destination_store_id: destinationStoreId,
        movement_type: 'STOCK_TRANSFER',
        quantity: quantity,
        reference_type: 'STORE_TRANSFER',
        reference_id: null,
        reason: reason,
        performed_by: actorId
      })
      .select()
      .single();

    if (moveErr) {
      logger.error('Stock transfer movement log error', { error: moveErr.message });
    }

    return {
      transferredQuantity: quantity,
      sourceInventory: updatedSource,
      destinationInventory: updatedDest,
      movement
    };
  }

  /**
   * Atomic inventory reservation for online orders using the PostgreSQL stored procedure
   */
  static async reserveInventory({ storeId, variantId, quantity, orderId }, actorId) {
    const { data, error } = await supabaseAdmin.rpc('reserve_inventory_for_order', {
      p_store_id: storeId,
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
      storeId,
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
    storeId,
    variantId,
    movementType,
    referenceType
  } = {}, userProfile) {
    const offset = (page - 1) * limit;
    const permittedStoreIds = await this.getAssignedStoreIds(userProfile);

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        id, variant_id, source_store_id, destination_store_id, movement_type, quantity, reference_type, reference_id, reason, created_at,
        sourceStore:stores!stock_movements_source_store_id_fkey(id, name, code),
        destinationStore:stores!stock_movements_destination_store_id_fkey(id, name, code),
        variant:product_variants(id, sku, product:products(id, title, slug)),
        performer:profiles!stock_movements_performed_by_fkey(id, first_name, last_name, role)
      `, { count: 'exact' });

    if (permittedStoreIds !== null) {
      query = query.or(`source_store_id.in.(${permittedStoreIds.join(',')}),destination_store_id.in.(${permittedStoreIds.join(',')})`);
    }

    if (storeId) {
      query = query.or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`);
    }

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
   * Get low-stock items based on defined thresholds
   */
  static async getLowStockItems({ page = 1, limit = 20, storeId } = {}, userProfile) {
    return this.listInventory({ page, limit, storeId, lowStockOnly: true }, userProfile);
  }
}
