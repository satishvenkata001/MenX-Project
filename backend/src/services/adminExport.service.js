import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { getStockWarningStatus } from './inventory.service.js';
import { generateCsvBuffer, generateExcelBuffer } from '../utils/exportGenerators.js';

export class AdminExportService {
  /**
   * Records an audit log entry for a dataset export event.
   */
  static async recordExportAudit({
    actorId,
    actorRole,
    action,
    dataset,
    format,
    filters = {},
    rowCount = 0,
    clientIp = null,
    userAgent = null
  }) {
    try {
      const payload = {
        dataset,
        format,
        filters,
        rowCount,
        timestamp: new Date().toISOString()
      };

      if (pool) {
        await pool.query(
          `INSERT INTO audit_logs (
            actor_id, actor_role, action, target_entity, target_id, new_values, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)`,
          [
            actorId || null,
            actorRole || 'ADMIN',
            action || 'EXPORT_DATASET',
            'DATA_CENTER',
            JSON.stringify(payload),
            clientIp,
            userAgent
          ]
        );
      } else {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: actorId || null,
          actor_role: actorRole || 'ADMIN',
          action: action || 'EXPORT_DATASET',
          target_entity: 'DATA_CENTER',
          new_values: payload,
          ip_address: clientIp,
          user_agent: userAgent
        });
      }
    } catch (err) {
      // Non-fatal: do not block export if audit logging encounters a database hiccup, but log warning
      logger.warn('Failed to record export audit log', { error: err.message, dataset, actorId });
    }
  }

  /**
   * Generates a Products & Stock export buffer in CSV or XLSX format.
   */
  static async exportProductsAndStock({ format = 'csv', status, categoryId, stockStatus } = {}, actorContext = {}) {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured');
    }

    try {
      const statusFilter = status && status !== 'ALL' ? status : null;
      const categoryFilter = categoryId && categoryId.trim() !== '' ? categoryId : null;

      const query = `
        SELECT 
          p.id AS product_id,
          p.title AS product_name,
          p.slug AS product_slug,
          c.name AS category_name,
          sc.name AS subcategory_name,
          b.name AS brand_name,
          pv.id AS variant_id,
          pv.sku,
          pv.barcode,
          s.name AS size_name,
          col.name AS color_name,
          p.base_mrp::numeric,
          p.base_price::numeric,
          pv.mrp::numeric AS variant_mrp,
          pv.selling_price::numeric AS variant_price,
          COALESCE(ii.quantity_available, 0)::int AS stock_available,
          COALESCE(ii.quantity_reserved, 0)::int AS stock_reserved,
          COALESCE(ii.quantity_damaged, 0)::int AS stock_damaged,
          (COALESCE(ii.quantity_available, 0) + COALESCE(ii.quantity_reserved, 0) + COALESCE(ii.quantity_damaged, 0))::int AS stock_total,
          COALESCE(pv.low_stock_threshold, 5)::int AS low_stock_threshold,
          p.status AS product_status,
          COALESCE(pv.is_active, true) AS variant_active,
          p.created_at AS product_created_at,
          pv.created_at AS variant_created_at
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        LEFT JOIN sizes s ON s.id = pv.size_id
        LEFT JOIN colors col ON col.id = pv.color_id
        LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
        WHERE ($1::text IS NULL OR p.status::text = $1)
          AND ($2::uuid IS NULL OR p.category_id = $2)
        ORDER BY p.title ASC, pv.sku ASC;
      `;

      const { rows } = await pool.query(query, [statusFilter, categoryFilter]);

      // Transform rows and evaluate authoritative stock status using canonical InventoryService logic
      let processedRows = rows.map(r => {
        const threshold = r.low_stock_threshold ?? 5;
        const warning = getStockWarningStatus(r.stock_available, threshold);

        return {
          product_id: r.product_id || '',
          product_name: r.product_name || '',
          category_name: r.category_name || 'Uncategorized',
          subcategory_name: r.subcategory_name || '',
          brand_name: r.brand_name || 'MENX',
          sku: r.sku || (r.variant_id ? 'N/A' : '(No Variant)'),
          barcode: r.barcode || '',
          size_name: r.size_name || 'Standard',
          color_name: r.color_name || 'Standard',
          base_mrp: r.base_mrp ? Number(r.base_mrp) : 0,
          base_price: r.base_price ? Number(r.base_price) : 0,
          variant_mrp: r.variant_mrp ? Number(r.variant_mrp) : (r.base_mrp ? Number(r.base_mrp) : 0),
          variant_price: r.variant_price ? Number(r.variant_price) : (r.base_price ? Number(r.base_price) : 0),
          stock_available: Number(r.stock_available) || 0,
          stock_reserved: Number(r.stock_reserved) || 0,
          stock_damaged: Number(r.stock_damaged) || 0,
          stock_total: Number(r.stock_total) || 0,
          low_stock_threshold: threshold,
          stock_status: warning.status,
          product_status: r.product_status || 'DRAFT',
          variant_active: r.variant_active ? 'ACTIVE' : 'INACTIVE',
          created_at: r.product_created_at ? new Date(r.product_created_at).toISOString().split('T')[0] : ''
        };
      });

      // Optional stock status filtering
      if (stockStatus && stockStatus !== 'ALL') {
        processedRows = processedRows.filter(r => r.stock_status === stockStatus);
      }

      const columns = [
        { key: 'product_id', header: 'Product ID', width: 38 },
        { key: 'product_name', header: 'Product Name', width: 32 },
        { key: 'category_name', header: 'Category', width: 18 },
        { key: 'subcategory_name', header: 'Subcategory', width: 20 },
        { key: 'brand_name', header: 'Brand', width: 18 },
        { key: 'sku', header: 'SKU', width: 22 },
        { key: 'barcode', header: 'Barcode', width: 18 },
        { key: 'size_name', header: 'Size', width: 12 },
        { key: 'color_name', header: 'Color', width: 14 },
        { key: 'variant_mrp', header: 'MRP (₹)', width: 14, isNumber: true },
        { key: 'variant_price', header: 'Selling Price (₹)', width: 16, isNumber: true },
        { key: 'stock_available', header: 'Stock Available', width: 16, isNumber: true },
        { key: 'stock_reserved', header: 'Stock Reserved', width: 16, isNumber: true },
        { key: 'stock_damaged', header: 'Stock Damaged', width: 16, isNumber: true },
        { key: 'stock_total', header: 'Stock Total', width: 16, isNumber: true },
        { key: 'low_stock_threshold', header: 'Low Stock Threshold', width: 20, isNumber: true },
        { key: 'stock_status', header: 'Stock Status', width: 16 },
        { key: 'product_status', header: 'Product Status', width: 16 },
        { key: 'variant_active', header: 'Variant Status', width: 16 },
        { key: 'created_at', header: 'Created Date', width: 16, isDate: true }
      ];

      const nowStr = new Date().toISOString().split('T')[0];
      const filename = `MENX_Products_Stock_${nowStr}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      let fileBuffer;

      if (format === 'xlsx') {
        fileBuffer = await generateExcelBuffer('Products_Stock', columns, processedRows);
      } else {
        fileBuffer = generateCsvBuffer(columns, processedRows);
      }

      // Record audit log
      await this.recordExportAudit({
        actorId: actorContext.userId,
        actorRole: actorContext.role,
        action: 'EXPORT_PRODUCTS_STOCK',
        dataset: 'PRODUCTS_STOCK',
        format: format.toUpperCase(),
        filters: { status, categoryId, stockStatus },
        rowCount: processedRows.length,
        clientIp: actorContext.ip,
        userAgent: actorContext.userAgent
      });

      return {
        buffer: fileBuffer,
        filename,
        contentType: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
        rowCount: processedRows.length
      };
    } catch (err) {
      logger.error('Failed to export products and stock', { error: err.message });
      throw AppError.internal('Failed to generate Products & Stock export');
    }
  }

  /**
   * Generates an Orders export buffer in CSV or XLSX format.
   * Exports 1 row per order line item for analytical spreadsheet consistency.
   */
  static async exportOrders({ format = 'csv', fromDate, toDate, orderStatus } = {}, actorContext = {}) {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured');
    }

    try {
      let fromTimestamp = null;
      let toTimestamp = null;

      if (fromDate && fromDate.trim() !== '') {
        fromTimestamp = new Date(`${fromDate.trim()}T00:00:00.000Z`).toISOString();
      }
      if (toDate && toDate.trim() !== '') {
        // End of the day
        toTimestamp = new Date(`${toDate.trim()}T23:59:59.999Z`).toISOString();
      }

      const statusFilter = orderStatus && orderStatus !== 'ALL' ? orderStatus : null;

      const query = `
        SELECT 
          o.id AS order_id,
          o.order_number,
          o.created_at AS order_date,
          o.order_status,
          o.payment_method,
          o.payment_status,
          o.subtotal_amount::numeric AS order_subtotal,
          o.discount_amount::numeric AS order_discount,
          o.delivery_fee::numeric AS order_delivery_fee,
          o.total_payable::numeric AS order_total,
          o.customer_phone,
          p.first_name AS customer_first_name,
          p.last_name AS customer_last_name,
          p.email AS customer_email,
          COALESCE(o.shipping_snapshot->>'city', '') AS shipping_city,
          COALESCE(o.shipping_snapshot->>'state', '') AS shipping_state,
          COALESCE(o.shipping_snapshot->>'postal_code', '') AS shipping_pincode,
          o.courier_partner,
          o.tracking_number,
          oi.id AS order_item_id,
          oi.product_title_snapshot AS product_title,
          oi.variant_sku_snapshot AS variant_sku,
          oi.size_snapshot AS variant_size,
          oi.color_snapshot AS variant_color,
          COALESCE(oi.quantity, 1)::int AS item_quantity,
          oi.unit_mrp_snapshot::numeric AS item_unit_mrp,
          oi.unit_price_snapshot::numeric AS item_unit_price,
          oi.line_subtotal::numeric AS item_line_subtotal,
          oi.line_discount::numeric AS item_line_discount,
          oi.line_total::numeric AS item_line_total
        FROM orders o
        LEFT JOIN profiles p ON p.id = o.customer_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE ($1::timestamptz IS NULL OR o.created_at >= $1)
          AND ($2::timestamptz IS NULL OR o.created_at <= $2)
          AND ($3::text IS NULL OR o.order_status::text = $3)
        ORDER BY o.created_at DESC, o.order_number DESC, oi.product_title_snapshot ASC;
      `;

      const { rows } = await pool.query(query, [fromTimestamp, toTimestamp, statusFilter]);

      const processedRows = rows.map(r => {
        const customerName = [r.customer_first_name, r.customer_last_name].filter(Boolean).join(' ') || 'Customer';

        return {
          order_number: r.order_number || '',
          order_date: r.order_date ? new Date(r.order_date).toISOString().replace('T', ' ').substring(0, 19) : '',
          order_status: r.order_status || 'PENDING',
          customer_name: customerName,
          customer_email: r.customer_email || '',
          customer_phone: r.customer_phone || '',
          shipping_city: r.shipping_city || '',
          shipping_state: r.shipping_state || '',
          shipping_pincode: r.shipping_pincode || '',
          payment_method: r.payment_method || 'COD',
          payment_status: r.payment_status || 'PENDING',
          product_title: r.product_title || 'N/A',
          variant_sku: r.variant_sku || 'N/A',
          variant_size: r.variant_size || 'N/A',
          variant_color: r.variant_color || 'N/A',
          item_quantity: Number(r.item_quantity) || 1,
          item_unit_mrp: r.item_unit_mrp ? Number(r.item_unit_mrp) : 0,
          item_unit_price: r.item_unit_price ? Number(r.item_unit_price) : 0,
          item_line_subtotal: r.item_line_subtotal ? Number(r.item_line_subtotal) : 0,
          item_line_discount: r.item_line_discount ? Number(r.item_line_discount) : 0,
          item_line_total: r.item_line_total ? Number(r.item_line_total) : 0,
          order_subtotal: r.order_subtotal ? Number(r.order_subtotal) : 0,
          order_discount: r.order_discount ? Number(r.order_discount) : 0,
          order_delivery_fee: r.order_delivery_fee ? Number(r.order_delivery_fee) : 0,
          order_total: r.order_total ? Number(r.order_total) : 0,
          courier_partner: r.courier_partner || '',
          tracking_number: r.tracking_number || ''
        };
      });

      const columns = [
        { key: 'order_number', header: 'Order Number', width: 20 },
        { key: 'order_date', header: 'Order Date (UTC)', width: 22, isDate: true },
        { key: 'order_status', header: 'Order Status', width: 16 },
        { key: 'customer_name', header: 'Customer Name', width: 22 },
        { key: 'customer_email', header: 'Customer Email', width: 28 },
        { key: 'customer_phone', header: 'Customer Phone', width: 18 },
        { key: 'shipping_city', header: 'City', width: 16 },
        { key: 'shipping_state', header: 'State', width: 16 },
        { key: 'shipping_pincode', header: 'Pincode', width: 14 },
        { key: 'payment_method', header: 'Payment Method', width: 16 },
        { key: 'payment_status', header: 'Payment Status', width: 16 },
        { key: 'product_title', header: 'Product Item', width: 30 },
        { key: 'variant_sku', header: 'Item SKU', width: 22 },
        { key: 'variant_size', header: 'Size', width: 12 },
        { key: 'variant_color', header: 'Color', width: 14 },
        { key: 'item_quantity', header: 'Quantity', width: 12, isNumber: true },
        { key: 'item_unit_mrp', header: 'Unit MRP (₹)', width: 14, isNumber: true },
        { key: 'item_unit_price', header: 'Unit Price (₹)', width: 14, isNumber: true },
        { key: 'item_line_subtotal', header: 'Line Subtotal (₹)', width: 16, isNumber: true },
        { key: 'item_line_discount', header: 'Line Discount (₹)', width: 16, isNumber: true },
        { key: 'item_line_total', header: 'Line Total (₹)', width: 16, isNumber: true },
        { key: 'order_subtotal', header: 'Order Subtotal (₹)', width: 18, isNumber: true },
        { key: 'order_discount', header: 'Order Discount (₹)', width: 18, isNumber: true },
        { key: 'order_delivery_fee', header: 'Delivery Fee (₹)', width: 16, isNumber: true },
        { key: 'order_total', header: 'Order Total Payable (₹)', width: 22, isNumber: true },
        { key: 'courier_partner', header: 'Courier Partner', width: 18 },
        { key: 'tracking_number', header: 'Tracking Number', width: 20 }
      ];

      const nowStr = new Date().toISOString().split('T')[0];
      const rangeSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : (fromDate ? `from_${fromDate}` : nowStr);
      const filename = `MENX_Orders_${rangeSuffix}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      let fileBuffer;

      if (format === 'xlsx') {
        fileBuffer = await generateExcelBuffer('Orders', columns, processedRows);
      } else {
        fileBuffer = generateCsvBuffer(columns, processedRows);
      }

      // Record audit log
      await this.recordExportAudit({
        actorId: actorContext.userId,
        actorRole: actorContext.role,
        action: 'EXPORT_ORDERS',
        dataset: 'ORDERS',
        format: format.toUpperCase(),
        filters: { fromDate, toDate, orderStatus },
        rowCount: processedRows.length,
        clientIp: actorContext.ip,
        userAgent: actorContext.userAgent
      });

      return {
        buffer: fileBuffer,
        filename,
        contentType: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
        rowCount: processedRows.length
      };
    } catch (err) {
      logger.error('Failed to export orders', { error: err.message });
      throw AppError.internal('Failed to generate Orders export');
    }
  }

  /**
   * Retrieves summary statistics and dataset availability for Data Center.
   */
  static async getExportSummary() {
    if (!pool) {
      throw AppError.internal('Database connection pool is not configured');
    }

    try {
      const [prodRes, orderRes] = await Promise.all([
        pool.query(`
          SELECT 
            COUNT(DISTINCT p.id)::int AS total_products,
            COUNT(pv.id)::int AS total_variants,
            SUM(COALESCE(ii.quantity_available, 0))::int AS total_stock_available
          FROM products p
          LEFT JOIN product_variants pv ON pv.product_id = p.id
          LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
        `),
        pool.query(`
          SELECT 
            COUNT(o.id)::int AS total_orders,
            COUNT(oi.id)::int AS total_order_items,
            MIN(o.created_at) AS earliest_order_date,
            MAX(o.created_at) AS latest_order_date
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
        `)
      ]);

      const prodStats = prodRes.rows[0] || {};
      const orderStats = orderRes.rows[0] || {};

      return {
        datasets: [
          {
            id: 'products_stock',
            name: 'Products & Stock',
            description: 'Complete catalog taxonomy, variant specifications, live inventory quantities, and threshold warning statuses.',
            recordCount: prodStats.total_variants || prodStats.total_products || 0,
            supportedFormats: ['csv', 'xlsx'],
            hasDateFilter: false
          },
          {
            id: 'orders',
            name: 'Orders & Line Items',
            description: 'Fulfillment orders, line-item pricing snapshots, buyer phone/email, delivery locations, and financial totals.',
            recordCount: orderStats.total_orders || 0,
            earliestDate: orderStats.earliest_order_date,
            latestDate: orderStats.latest_order_date,
            supportedFormats: ['csv', 'xlsx'],
            hasDateFilter: true
          }
        ],
        summary: {
          productsCount: prodStats.total_products || 0,
          variantsCount: prodStats.total_variants || 0,
          totalStockUnits: prodStats.total_stock_available || 0,
          ordersCount: orderStats.total_orders || 0,
          orderItemsCount: orderStats.total_order_items || 0
        }
      };
    } catch (err) {
      logger.error('Failed to get export summary metrics', { error: err.message });
      throw AppError.internal('Failed to retrieve export summary');
    }
  }
}
