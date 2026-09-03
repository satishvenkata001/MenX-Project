import { CatalogService } from '../services/catalog.service.js';
import { StorageService } from '../services/storage.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/response.js';
import path from 'path';

export class AdminCatalogController {
  /**
   * POST /api/v1/admin/products
   */
  static createProduct = asyncHandler(async (req, res) => {
    const product = await CatalogService.createProduct(req.body, req.user.id, req.token);
    return sendCreated(res, product, 'Product created successfully');
  });

  /**
   * PATCH /api/v1/admin/products/:id
   */
  static updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await CatalogService.updateProduct(id, req.body, req.token);
    return sendSuccess(res, product, 'Product updated successfully');
  });

  /**
   * POST /api/v1/admin/products/:id/archive
   */
  static archiveProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await CatalogService.archiveProduct(id, req.token);
    return sendSuccess(res, product, 'Product archived successfully');
  });

  /**
   * POST /api/v1/admin/products/:id/variants
   */
  static createVariant = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const variant = await CatalogService.createVariant(id, req.body, req.token);
    return sendCreated(res, variant, 'Product variant created successfully');
  });

  /**
   * PATCH /api/v1/admin/variants/:id
   */
  static updateVariant = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const variant = await CatalogService.updateVariant(id, req.body, req.token);
    return sendSuccess(res, variant, 'Product variant updated successfully');
  });

  /**
   * POST /api/v1/admin/products/:id/images
   */
  static createImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const image = await CatalogService.createImage(id, req.body, req.token);
    return sendCreated(res, image, 'Product image record created successfully');
  });

  /**
   * POST /api/v1/admin/products/:id/images/upload
   */
  static uploadProductImage = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Verify product exists
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (prodErr || !product) {
      throw AppError.notFound(`Product with ID '${id}' not found`);
    }

    // 2. Validate file presence
    if (!req.file) {
      throw AppError.badRequest('No image file provided in multipart request');
    }

    const file = req.file;

    // 3. Validate MIME type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw AppError.badRequest(`Unsupported MIME type: '${file.mimetype}'. Allowed: JPEG, PNG, WEBP.`);
    }

    // 4. Validate extension
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw AppError.badRequest(`Unsupported file extension: '${ext}'. Allowed: .jpg, .jpeg, .png, .webp.`);
    }

    // 5. Upload to storage
    const uploadResult = await StorageService.uploadProductImage(id, file.buffer, file.mimetype, file.originalname);
    const { storagePath, publicUrl } = uploadResult;

    // 6. Save metadata to product_images table
    try {
      const variantId = req.body.variantId || null;
      const altText = req.body.altText || null;
      const displayOrder = parseInt(req.body.displayOrder, 10) || 0;
      const isPrimary = req.body.isPrimary === 'true' || req.body.isPrimary === true;

      const image = await CatalogService.createImage(id, {
        variantId,
        imageUrl: publicUrl,
        altText,
        displayOrder,
        isPrimary
      }, req.token);

      return sendCreated(res, image, 'Product image uploaded and registered successfully');
    } catch (dbErr) {
      // Orphan cleanup: Attempt to delete the storage file if the DB transaction/insert fails
      logger.error(`Database image registration failed, performing storage cleanup for: ${storagePath}`, dbErr);
      try {
        await StorageService.deleteProductImage(storagePath);
      } catch (cleanupErr) {
        logger.error(`Failed to perform compensating storage cleanup for: ${storagePath}`, cleanupErr);
      }
      throw dbErr;
    }
  });

  /**
   * PATCH /api/v1/admin/products/:id/images/reorder
   */
  static reorderImages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await CatalogService.reorderImages(id, req.body.images, req.token);
    return sendSuccess(res, result, 'Product images reordered successfully');
  });

  /**
   * POST /api/v1/admin/images/:id/primary
   */
  static setPrimaryImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await CatalogService.setPrimaryImage(id, req.token);
    return sendSuccess(res, result, 'Product image set as primary successfully');
  });

  /**
   * DELETE /api/v1/admin/images/:id
   */
  static deleteImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await CatalogService.deleteImage(id, req.token);
    return sendSuccess(res, result, 'Product image record deleted successfully');
  });

  /**
   * GET /api/v1/admin/categories
   */
  static listCategories = asyncHandler(async (req, res) => {
    const categories = await CatalogService.listAdminCategories();
    return sendSuccess(res, categories, 'Admin categories retrieved successfully');
  });

  /**
   * POST /api/v1/admin/categories
   */
  static createCategory = asyncHandler(async (req, res) => {
    const category = await CatalogService.createCategory(req.body, req.token);
    return sendCreated(res, category, 'Category created successfully');
  });

  /**
   * PATCH /api/v1/admin/categories/:id
   */
  static updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await CatalogService.updateCategory(id, req.body, req.token);
    return sendSuccess(res, category, 'Category updated successfully');
  });

  /**
   * POST /api/v1/admin/subcategories
   */
  static createSubcategory = asyncHandler(async (req, res) => {
    const subcategory = await CatalogService.createSubcategory(req.body, req.token);
    return sendCreated(res, subcategory, 'Subcategory created successfully');
  });

  /**
   * PATCH /api/v1/admin/subcategories/:id
   */
  static updateSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const subcategory = await CatalogService.updateSubcategory(id, req.body, req.token);
    return sendSuccess(res, subcategory, 'Subcategory updated successfully');
  });

  /**
   * POST /api/v1/admin/brands
   */
  static createBrand = asyncHandler(async (req, res) => {
    const brand = await CatalogService.createBrand(req.body, req.token);
    return sendCreated(res, brand, 'Brand created successfully');
  });

  /**
   * PATCH /api/v1/admin/brands/:id
   */
  static updateBrand = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const brand = await CatalogService.updateBrand(id, req.body, req.token);
    return sendSuccess(res, brand, 'Brand updated successfully');
  });

  /**
   * DELETE /api/v1/admin/products/:id or /api/v1/products/:id
   */
  static deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = {
      id: req.user?.id,
      role: req.profile?.role || req.user?.role || 'SUPER_ADMIN'
    };
    const reqInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent')
    };
    const result = await CatalogService.deleteProduct(id, actor, req.token, reqInfo);
    return sendSuccess(res, result, result.message || 'Product deleted successfully');
  });

  /**
   * DELETE /api/v1/admin/categories/:id or /api/v1/categories/:id
   */
  static deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = {
      id: req.user?.id,
      role: req.profile?.role || req.user?.role || 'SUPER_ADMIN'
    };
    const reqInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent')
    };
    const result = await CatalogService.deleteCategory(id, actor, req.token, reqInfo);
    return sendSuccess(res, result, result.message || 'Category deleted successfully');
  });

  /**
   * DELETE /api/v1/admin/subcategories/:id
   */
  static deleteSubcategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const actor = {
      id: req.user?.id,
      role: req.profile?.role || req.user?.role || 'SUPER_ADMIN'
    };
    const reqInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent')
    };
    const result = await CatalogService.deleteSubcategory(id, actor, req.token, reqInfo);
    return sendSuccess(res, result, result.message || 'Subcategory deleted successfully');
  });
}
