import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  idParamSchema,
  paginationQuerySchema,
  slugParamSchema
} from '../validators/catalog.validator.js';

const router = Router();

// Categories
router.get('/categories', CatalogController.listCategories);
router.get('/categories/:slug', validateRequest(slugParamSchema), CatalogController.getCategoryBySlug);

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

export default router;
