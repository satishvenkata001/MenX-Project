import { CatalogService } from '../services/catalog.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { USER_ROLES } from '../config/constants.js';

export class CatalogController {
  /**
   * GET /api/v1/categories
   */
  static listCategories = asyncHandler(async (req, res) => {
    const categories = await CatalogService.listCategories();
    return sendSuccess(res, categories, 'Categories retrieved successfully');
  });

  /**
   * GET /api/v1/categories/:slug
   */
  static getCategoryBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const category = await CatalogService.getCategoryBySlug(slug);
    return sendSuccess(res, category, 'Category details retrieved successfully');
  });

  /**
   * GET /api/v1/subcategories
   */
  static listSubcategories = asyncHandler(async (req, res) => {
    const categoryId = req.query.categoryId || req.query.category_id;
    const categorySlug = req.query.categorySlug || req.query.category_slug;
    const subcategories = await CatalogService.listSubcategories({ categoryId, categorySlug });
    return sendSuccess(res, subcategories, 'Subcategories retrieved successfully');
  });

  /**
   * GET /api/v1/brands
   */
  static listBrands = asyncHandler(async (req, res) => {
    const brands = await CatalogService.listBrands();
    return sendSuccess(res, brands, 'Brands retrieved successfully');
  });

  /**
   * GET /api/v1/sizes
   */
  static listSizes = asyncHandler(async (req, res) => {
    const sizes = await CatalogService.listSizes(req.query);
    return sendSuccess(res, sizes, 'Sizes retrieved successfully');
  });

  /**
   * GET /api/v1/colors
   */
  static listColors = asyncHandler(async (req, res) => {
    const colors = await CatalogService.listColors();
    return sendSuccess(res, colors, 'Colors retrieved successfully');
  });

  /**
   * GET /api/v1/products
   */
  static listProducts = asyncHandler(async (req, res) => {
    const userRole = req.profile?.role;
    const isManagerOrAdmin = [
      USER_ROLES.INVENTORY_MANAGER,
      USER_ROLES.STORE_MANAGER,
      USER_ROLES.SUPER_ADMIN
    ].includes(userRole);

    const queryOptions = { ...req.query };

    // Normal customers and unauthenticated guests must NEVER retrieve DRAFT or ARCHIVED products
    // If not an authorized manager or super admin, ignore/override status parameter and force to 'PUBLISHED'
    if (!isManagerOrAdmin) {
      queryOptions.status = 'PUBLISHED';
    }

    const result = await CatalogService.listProducts(queryOptions);
    return sendSuccess(res, result.items, 'Products retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/products/:slug
   */
  static getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const userRole = req.profile?.role;
    const isManagerOrAdmin = [
      USER_ROLES.INVENTORY_MANAGER,
      USER_ROLES.STORE_MANAGER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.STORE_STAFF
    ].includes(userRole);

    // Only internal staff/manager/admin can retrieve unlisted/DRAFT/ARCHIVED product details by slug
    const includeUnpublished = isManagerOrAdmin;
    const product = await CatalogService.getProductBySlug(slug, { includeUnpublished });
    return sendSuccess(res, product, 'Product details retrieved successfully');
  });

  /**
   * GET /api/v1/products/:id/variants
   */
  static getProductVariants = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const variants = await CatalogService.getProductVariants(id);
    return sendSuccess(res, variants, 'Product variants retrieved successfully');
  });

  /**
   * GET /api/v1/products/:id/images
   */
  static getProductImages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const images = await CatalogService.getProductImages(id);
    return sendSuccess(res, images, 'Product images retrieved successfully');
  });
}
