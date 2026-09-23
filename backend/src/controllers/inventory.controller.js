import { InventoryService } from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export class InventoryController {
  /**
   * GET /api/v1/admin/inventory
   */
  static listInventory = asyncHandler(async (req, res) => {
    const result = await InventoryService.listInventory(req.query);
    return sendSuccess(res, result.items, 'Inventory items retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/admin/inventory/:id
   */
  static getInventoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await InventoryService.getInventoryById(id);
    return sendSuccess(res, item, 'Inventory item details retrieved successfully');
  });

  /**
   * POST /api/v1/admin/inventory/adjust
   */
  static adjustStock = asyncHandler(async (req, res) => {
    const result = await InventoryService.adjustStock(req.body, req.user.id);
    return sendSuccess(res, result, 'Stock adjusted successfully');
  });

  /**
   * POST /api/v1/admin/inventory/reserve
   */
  static reserveInventory = asyncHandler(async (req, res) => {
    const result = await InventoryService.reserveInventory(req.body, req.user.id);
    return sendSuccess(res, result, 'Inventory reserved successfully');
  });

  /**
   * GET /api/v1/admin/inventory/movements
   */
  static listStockMovements = asyncHandler(async (req, res) => {
    const result = await InventoryService.listStockMovements(req.query);
    return sendSuccess(res, result.movements, 'Stock movements retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/admin/inventory/low-stock
   */
  static getLowStock = asyncHandler(async (req, res) => {
    const result = await InventoryService.getLowStockItems(req.query);
    return sendSuccess(res, {
      products: result.products,
      total: result.totalProducts,
      totalProducts: result.totalProducts,
      totalVariants: result.totalVariants,
      totalLowStockVariants: result.totalLowStockVariants,
      items: result.items
    }, 'Low stock items retrieved successfully', result.pagination);
  });
}
