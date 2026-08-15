import { CatalogService } from '../services/catalog.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

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
    const { categoryId, categorySlug } = req.query;
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
    const sizes = await CatalogService.listSizes();
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
    const result = await CatalogService.listProducts(req.query);
    return sendSuccess(res, result.items, 'Products retrieved successfully', result.pagination);
  });

  /**
   * GET /api/v1/products/:slug
   */
  static getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const product = await CatalogService.getProductBySlug(slug);
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
