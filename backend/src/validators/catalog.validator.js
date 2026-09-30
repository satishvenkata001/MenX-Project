import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
    limit: z.string().optional().transform(val => (val ? Math.min(50, Math.max(1, parseInt(val, 10) || 12)) : 12)),
    search: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    subcategory: z.string().max(100).optional(),
    brand: z.string().max(100).optional(),
    size: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    minPrice: z.string().optional().transform(val => (val ? parseFloat(val) : undefined)),
    maxPrice: z.string().optional().transform(val => (val ? parseFloat(val) : undefined)),
    sortBy: z.enum(['newest', 'price-asc', 'price-desc', 'name-asc', 'name-desc']).optional().default('newest'),
    status: z.enum(['PUBLISHED', 'DRAFT', 'ARCHIVED', 'ALL', 'all']).optional()
  })
});

export const slugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, 'Slug is required').max(280)
  })
});

export const idParamSchema = z.object({
  params: z.object({
    id: uuidSchema
  })
});

// Category Validators
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    slug: z.string().min(1, 'Slug is required').max(120).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().max(1000).optional().nullable(),
    imageUrl: z.string().url('Image URL must be a valid URL').optional().nullable(),
    displayOrder: z.number().int().min(0).optional().default(0)
  })
});

export const updateCategorySchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(120).regex(slugRegex).optional(),
    description: z.string().max(1000).optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' })
});

// Subcategory Validators
export const createSubcategorySchema = z.object({
  body: z.object({
    categoryId: uuidSchema,
    name: z.string().min(1, 'Name is required').max(100),
    slug: z.string().min(1, 'Slug is required').max(120).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().max(1000).optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
    displayOrder: z.number().int().min(0).optional().default(0)
  })
});

export const updateSubcategorySchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    categoryId: uuidSchema.optional(),
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(120).regex(slugRegex).optional(),
    description: z.string().max(1000).optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' })
});

// Brand Validators
export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    slug: z.string().trim().min(1, 'Slug is required').max(120).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().trim().max(2000).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional().default(true)
  })
});

export const updateBrandSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    slug: z.string().trim().min(1).max(120).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens').optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' })
});

// Color Validators
export const hexCodeRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const createColorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Color name is required').max(50, 'Color name must be at most 50 characters'),
    hexCode: z.string().trim().regex(hexCodeRegex, 'Hex code must be a valid 3 or 6-digit hex format (e.g. #FFF or #FFFFFF)').optional(),
    hex_code: z.string().trim().regex(hexCodeRegex, 'Hex code must be a valid 3 or 6-digit hex format (e.g. #FFF or #FFFFFF)').optional()
  }).refine(data => !!(data.hexCode || data.hex_code), {
    message: 'Hex code is required',
    path: ['hexCode']
  })
});

// Product Validators
export const createProductSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(280).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens'),
    description: z.string().min(1, 'Description is required').max(5000),
    categoryId: uuidSchema,
    subcategoryId: uuidSchema,
    brandId: uuidSchema.optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
    baseMrp: z.number().positive('baseMrp must be a positive number'),
    basePrice: z.number().positive('basePrice must be a positive number').optional(),
    material: z.string().max(150).optional().nullable(),
    careInstructions: z.string().max(1000).optional().nullable(),
    tags: z.array(z.string().max(50)).optional().default([]),
    isFeatured: z.boolean().optional().default(false)
  }).refine(data => {
    const price = data.basePrice !== undefined ? data.basePrice : data.baseMrp;
    return price <= data.baseMrp;
  }, {
    message: 'Base price cannot exceed base MRP',
    path: ['basePrice']
  })
});

export const updateProductSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(280).regex(slugRegex).optional(),
    description: z.string().min(1).max(5000).optional(),
    categoryId: uuidSchema.optional(),
    subcategoryId: uuidSchema.optional(),
    brandId: uuidSchema.optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    baseMrp: z.number().positive().optional(),
    basePrice: z.number().positive().optional(),
    material: z.string().max(150).optional().nullable(),
    careInstructions: z.string().max(1000).optional().nullable(),
    tags: z.array(z.string().max(50)).optional(),
    isFeatured: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' })
});

// Product Variant Validators
export const createVariantSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    sizeId: uuidSchema,
    colorId: uuidSchema,
    sku: z.string().min(1, 'SKU is required').max(100),
    barcode: z.string().min(1, 'Barcode is required').max(100),
    mrp: z.number().positive('MRP must be positive'),
    sellingPrice: z.number().positive('Selling price must be positive'),
    weightGrams: z.number().int().positive().optional().default(300),
    lowStockThreshold: z.number().int().min(0).optional().default(5),
    initialStock: z.number().int({ message: 'Initial stock must be an integer' }).min(0, { message: 'Initial stock cannot be negative' }).optional().default(0)
  })
}).refine(data => data.body.sellingPrice <= data.body.mrp, {
  message: 'Selling price cannot exceed MRP',
  path: ['body', 'sellingPrice']
});

export const bulkCreateVariantItemSchema = z.object({
  sizeId: uuidSchema,
  colorId: uuidSchema,
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().min(1, 'Barcode is required').max(100),
  mrp: z.number().positive('MRP must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  weightGrams: z.number().int().positive().optional().default(300),
  lowStockThreshold: z.number().int().min(0).optional().default(5),
  initialStock: z.number().int({ message: 'Initial stock must be an integer' }).min(0, { message: 'Initial stock cannot be negative' }).optional().default(0)
}).refine(data => data.sellingPrice <= data.mrp, {
  message: 'Selling price cannot exceed MRP',
  path: ['sellingPrice']
});

export const bulkCreateVariantSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    variants: z.array(bulkCreateVariantItemSchema)
      .min(1, 'At least one variant must be provided')
      .max(50, 'Cannot create more than 50 variants in a single bulk request')
  })
});

export const updateVariantSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    sku: z.string().min(1).max(100).optional(),
    barcode: z.string().max(100).optional(),
    mrp: z.number().positive().optional(),
    sellingPrice: z.number().positive().optional(),
    weightGrams: z.number().int().positive().optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  }).refine(data => {
    if (data.mrp !== undefined && data.sellingPrice !== undefined) {
      return data.sellingPrice <= data.mrp;
    }
    return true;
  }, {
    message: 'Selling price cannot exceed MRP',
    path: ['sellingPrice']
  })
});

// Product Image Validators
export const createImageSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    variantId: uuidSchema.optional().nullable(),
    imageUrl: z.string().url('imageUrl must be a valid URL'),
    altText: z.string().max(255).optional().nullable(),
    displayOrder: z.number().int().min(0).optional().default(0),
    isPrimary: z.boolean().optional().default(false)
  })
});

export const reorderImagesSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    images: z.array(
      z.object({
        imageId: uuidSchema,
        displayOrder: z.number().int().min(0)
      })
    ).nonempty('At least one image order must be specified')
  })
});

export const primaryImageSchema = z.object({
  params: z.object({ id: uuidSchema })
});
