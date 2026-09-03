import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller.js';
import { AdminCatalogController } from '../controllers/adminCatalog.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import {
  idParamSchema,
  paginationQuerySchema,
  slugParamSchema
} from '../validators/catalog.validator.js';

const router = Router();

const adminAuth = [
  requireAuth,
  requireRole(
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  )
];

// Categories
router.get('/categories', CatalogController.listCategories);
router.get('/categories/:slug', validateRequest(slugParamSchema), CatalogController.getCategoryBySlug);
router.delete('/categories/:id', ...adminAuth, validateRequest(idParamSchema), AdminCatalogController.deleteCategory);

// Subcategories, Brands, Sizes, Colors
router.get('/subcategories', CatalogController.listSubcategories);
router.get('/brands', CatalogController.listBrands);
router.get('/sizes', CatalogController.listSizes);
router.get('/colors', CatalogController.listColors);

// Products
router.get('/products', validateRequest(paginationQuerySchema), CatalogController.listProducts);
router.get('/products/:slug', validateRequest(slugParamSchema), CatalogController.getProductBySlug);
router.get('/products/:id/variants', validateRequest(idParamSchema), CatalogController.getProductVariants);
router.get('/products/:id/images', validateRequest(idParamSchema), CatalogController.getProductImages);
router.delete('/products/:id', ...adminAuth, validateRequest(idParamSchema), AdminCatalogController.deleteProduct);

export default router;
