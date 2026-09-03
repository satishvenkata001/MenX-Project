import { Router } from 'express';
import { AdminCatalogController } from '../controllers/adminCatalog.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import {
  createBrandSchema,
  createCategorySchema,
  createImageSchema,
  createProductSchema,
  createSubcategorySchema,
  createVariantSchema,
  idParamSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateProductSchema,
  updateSubcategorySchema,
  updateVariantSchema,
  reorderImagesSchema,
  primaryImageSchema
} from '../validators/catalog.validator.js';
import { parseMultipart } from '../middleware/multipart.js';

const router = Router();

// Apply auth & managerial / admin RBAC to all routes in this sub-router
router.use(
  requireAuth,
  requireRole(
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  )
);

// Products
router.post('/products', validateRequest(createProductSchema), AdminCatalogController.createProduct);
router.patch('/products/:id', validateRequest(updateProductSchema), AdminCatalogController.updateProduct);
router.post('/products/:id/archive', validateRequest(idParamSchema), AdminCatalogController.archiveProduct);
router.delete('/products/:id', validateRequest(idParamSchema), AdminCatalogController.deleteProduct);

// Variants
router.post('/products/:id/variants', validateRequest(createVariantSchema), AdminCatalogController.createVariant);
router.patch('/variants/:id', validateRequest(updateVariantSchema), AdminCatalogController.updateVariant);

// Images
  router.post('/products/:id/images', validateRequest(createImageSchema), AdminCatalogController.createImage);
  router.post('/products/:id/images/upload', parseMultipart, validateRequest(idParamSchema), AdminCatalogController.uploadProductImage);
  router.patch('/products/:id/images/reorder', validateRequest(reorderImagesSchema), AdminCatalogController.reorderImages);
  router.post('/images/:id/primary', validateRequest(primaryImageSchema), AdminCatalogController.setPrimaryImage);
  router.delete('/images/:id', validateRequest(idParamSchema), AdminCatalogController.deleteImage);

// Categories
router.get('/categories', AdminCatalogController.listCategories);
router.post('/categories', validateRequest(createCategorySchema), AdminCatalogController.createCategory);
router.patch('/categories/:id', validateRequest(updateCategorySchema), AdminCatalogController.updateCategory);
router.delete('/categories/:id', validateRequest(idParamSchema), AdminCatalogController.deleteCategory);

// Subcategories
router.post('/subcategories', validateRequest(createSubcategorySchema), AdminCatalogController.createSubcategory);
router.patch('/subcategories/:id', validateRequest(updateSubcategorySchema), AdminCatalogController.updateSubcategory);
router.delete('/subcategories/:id', validateRequest(idParamSchema), AdminCatalogController.deleteSubcategory);

// Brands
router.post('/brands', validateRequest(createBrandSchema), AdminCatalogController.createBrand);
router.patch('/brands/:id', validateRequest(updateBrandSchema), AdminCatalogController.updateBrand);

export default router;
