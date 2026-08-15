import { InventoryService } from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export class InventoryController {
  /**
   * GET /api/v1/admin/stores
   */
  static listStores = asyncHandler(async (req, res) => {
    const stores = await InventoryService.listStores();
    return sendSuccess(res, stores, 'Stores retrieved successfully');
  });

  /**
   * GET /api/v1/admin/inventory
   */
  static listInventory = asyncHandler(async (req, res) => {
    const result = await InventoryService.listInventory(req.query, req.profile);
    return sendSuccess(res, result.items, 'Inventory items retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/admin/inventory/:id
   */
  static getInventoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const item = await InventoryService.getInventoryById(id, req.profile);
    return sendSuccess(res, item, 'Inventory item details retrieved successfully');
  });

  /**
   * GET /api/v1/admin/inventory/store/:storeId
   */
  static getInventoryByStore = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const result = await InventoryService.listInventory({ ...req.query, storeId }, req.profile);
    return sendSuccess(res, result.items, 'Store inventory retrieved successfully', result.pagination);
  });

  /**
   * POST /api/v1/admin/inventory/adjust
   */
  static adjustStock = asyncHandler(async (req, res) => {
    const result = await InventoryService.adjustStock(req.body, req.user.id, req.profile);
    return sendSuccess(res, result, 'Stock adjusted successfully');
  });

  /**
   * POST /api/v1/admin/inventory/transfer
   */
  static transferStock = asyncHandler(async (req, res) => {
    const result = await InventoryService.transferStock(req.body, req.user.id, req.profile);
    return sendSuccess(res, result, 'Stock transferred successfully');
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
    const result = await InventoryService.listStockMovements(req.query, req.profile);
    return sendSuccess(res, result.movements, 'Stock movements retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/admin/inventory/low-stock
   */
  static getLowStock = asyncHandler(async (req, res) => {
    const result = await InventoryService.getLowStockItems(req.query, req.profile);
    return sendSuccess(res, result.items, 'Low stock items retrieved successfully', result.pagination);
  });
}
