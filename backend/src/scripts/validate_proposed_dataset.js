import { pool } from '../config/db.js';
import { isSizeValidForCategory } from '../config/categorySizes.js';

// Pre-constructed proposed dataset
const PROPOSED_DATASET = [
  {
    productNumber: 1,
    title: "AEROFIT PERFORMANCE CREW TEE",
    slug: "aerofit-performance-crew-tee",
    description: "High-performance moisture-wicking athletic crew neck t-shirt designed for gym workouts and everyday comfort.",
    categoryId: "4ecbcec1-19fb-45f1-9bc8-682e26e92814", // T-Shirts
    categoryName: "T-Shirts",
    subcategoryId: "31d37980-27ae-4c14-809a-f61e6d7081b3", // Round Neck
    subcategoryName: "Round Neck",
    brandId: "9781e17c-1071-4425-a4c0-ce7cc51ed999", // AeroFit Sport
    brandName: "AeroFit Sport",
    baseMrp: 999.00,
    basePrice: 499.00,
    material: "92% Polyester, 8% Spandex Breathable Knit",
    careInstructions: "Machine wash cold, do not tumble dry, cool iron if needed",
    tags: ["t-shirt", "round-neck", "activewear", "gym", "breathable", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    colorGroups: [
      {
        colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b",
        colorName: "Teal",
        mrp: 999.00,
        sellingPrice: 499.00,
        weightGrams: 200,
        lowStockThreshold: 5,
        sizes: [
          { sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "AEROFITP-TEAL-S-7101", barcode: "890710100101", stock: 15 },
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "AEROFITP-TEAL-M-7102", barcode: "890710100102", stock: 20 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "AEROFITP-TEAL-L-7103", barcode: "890710100103", stock: 4 }, // Low stock
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "AEROFITP-TEAL-XL-7104", barcode: "890710100104", stock: 12 }
        ]
      },
      {
        colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64",
        colorName: "Black",
        mrp: 999.00,
        sellingPrice: 499.00,
        weightGrams: 200,
        lowStockThreshold: 5,
        sizes: [
          { sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "AEROFITP-BLAC-S-7105", barcode: "890710100105", stock: 10 },
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "AEROFITP-BLAC-M-7106", barcode: "890710100106", stock: 25 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "AEROFITP-BLAC-L-7107", barcode: "890710100107", stock: 18 },
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "AEROFITP-BLAC-XL-7108", barcode: "890710100108", stock: 0 } // Zero stock
        ]
      }
    ]
  },
  {
    productNumber: 2,
    title: "CLASSIC SLIM FIT DENIM JEANS",
    slug: "classic-slim-fit-denim-jeans",
    description: "Tailored slim-fit dark washed jeans with premium stretch cotton construction for maximum durability and effortless movement.",
    categoryId: "c812ff12-6fe9-4b49-8a01-340750d3367f", // Jeans
    categoryName: "Jeans",
    subcategoryId: "c2863186-6bea-485b-a5f9-db419cc7dc91", // Slim Fit
    subcategoryName: "Slim Fit",
    brandId: "613f8ddb-c471-4608-ace2-ced11ab9c7bc", // MenX Sartorial
    brandName: "MenX Sartorial",
    baseMrp: 2499.00,
    basePrice: 1499.00,
    material: "98% Cotton Denim, 2% Elastane Stretch",
    careInstructions: "Machine wash inside out in cold water, wash separately, tumble dry low",
    tags: ["jeans", "denim", "slim-fit", "stretch", "casual", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    colorGroups: [
      {
        colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64",
        colorName: "Black",
        mrp: 2499.00,
        sellingPrice: 1499.00,
        weightGrams: 550,
        lowStockThreshold: 4,
        sizes: [
          { sizeId: "ab4fbbef-52c3-4c86-beb1-00715807a6bb", sizeName: "30", sku: "CLASSICS-BLAC-30-7201", barcode: "890720100201", stock: 8 },
          { sizeId: "3f106c8c-d7b4-44bb-9073-4e14d9550839", sizeName: "32", sku: "CLASSICS-BLAC-32-7202", barcode: "890720100202", stock: 14 },
          { sizeId: "5da9af00-bcd6-48fd-9dcf-36d55e11a49e", sizeName: "34", sku: "CLASSICS-BLAC-34-7203", barcode: "890720100203", stock: 12 },
          { sizeId: "38d04fc2-9837-498a-8425-6c4e6daa080d", sizeName: "36", sku: "CLASSICS-BLAC-36-7204", barcode: "890720100204", stock: 3 } // Low stock
        ]
      },
      {
        colorId: "792777e2-05d6-47ba-abae-04e32d0f6548",
        colorName: "Sky Blue",
        mrp: 2499.00,
        sellingPrice: 1499.00,
        weightGrams: 550,
        lowStockThreshold: 4,
        sizes: [
          { sizeId: "ab4fbbef-52c3-4c86-beb1-00715807a6bb", sizeName: "30", sku: "CLASSICS-SKYB-30-7205", barcode: "890720100205", stock: 6 },
          { sizeId: "3f106c8c-d7b4-44bb-9073-4e14d9550839", sizeName: "32", sku: "CLASSICS-SKYB-32-7206", barcode: "890720100206", stock: 10 },
          { sizeId: "5da9af00-bcd6-48fd-9dcf-36d55e11a49e", sizeName: "34", sku: "CLASSICS-SKYB-34-7207", barcode: "890720100207", stock: 7 },
          { sizeId: "38d04fc2-9837-498a-8425-6c4e6daa080d", sizeName: "36", sku: "CLASSICS-SKYB-36-7208", barcode: "890720100208", stock: 2 } // Low stock
        ]
      }
    ]
  },
  {
    productNumber: 3,
    title: "LUX SNEAKER LOW TOP",
    slug: "lux-sneaker-low-top",
    description: "Handcrafted minimalistic full-grain leather low-top sneakers equipped with high-density comfort insoles and vulcanized rubber soles.",
    categoryId: "1e6a3082-5bc0-48a6-8d80-0ce4ce6869b5", // Footwear
    categoryName: "Footwear",
    subcategoryId: "881c5ed3-a51b-49b2-b334-27b7a4c839ab", // Sneakers
    subcategoryName: "Sneakers",
    brandId: "618cb968-ea73-4375-b836-a80053028910", // Lux Classics
    brandName: "Lux Classics",
    baseMrp: 3499.00,
    basePrice: 1999.00,
    material: "Full Grain Leather Upper with Cushioned EVA Rubber Outsole",
    careInstructions: "Wipe with a clean damp cloth, use leather conditioner periodically",
    tags: ["footwear", "sneakers", "leather", "casual", "luxury", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    colorGroups: [
      {
        colorId: "cc0a4930-2e3c-40b2-b8d2-05661b97ef59",
        colorName: "Silver White",
        mrp: 3499.00,
        sellingPrice: 1999.00,
        weightGrams: 750,
        lowStockThreshold: 3,
        sizes: [
          { sizeId: "17728e1e-b8f5-4d20-87a1-2c7f918f7680", sizeName: "7", sku: "LUXSNEAK-SILV-7-7301", barcode: "890730100301", stock: 5 },
          { sizeId: "ee0136ae-58e7-4456-acc2-29972593f2ba", sizeName: "8", sku: "LUXSNEAK-SILV-8-7302", barcode: "890730100302", stock: 8 },
          { sizeId: "faf6a686-b3d4-4bf1-97ef-382a137843ba", sizeName: "9", sku: "LUXSNEAK-SILV-9-7303", barcode: "890730100303", stock: 12 },
          { sizeId: "f3f73fd0-6a42-431d-bb8e-467b8ad97076", sizeName: "10", sku: "LUXSNEAK-SILV-10-7304", barcode: "890730100304", stock: 2 } // Low stock
        ]
      },
      {
        colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64",
        colorName: "Black",
        mrp: 3499.00,
        sellingPrice: 1999.00,
        weightGrams: 750,
        lowStockThreshold: 3,
        sizes: [
          { sizeId: "17728e1e-b8f5-4d20-87a1-2c7f918f7680", sizeName: "7", sku: "LUXSNEAK-BLAC-7-7305", barcode: "890730100305", stock: 4 },
          { sizeId: "ee0136ae-58e7-4456-acc2-29972593f2ba", sizeName: "8", sku: "LUXSNEAK-BLAC-8-7306", barcode: "890730100306", stock: 10 },
          { sizeId: "faf6a686-b3d4-4bf1-97ef-382a137843ba", sizeName: "9", sku: "LUXSNEAK-BLAC-9-7307", barcode: "890730100307", stock: 7 },
          { sizeId: "f3f73fd0-6a42-431d-bb8e-467b8ad97076", sizeName: "10", sku: "LUXSNEAK-BLAC-10-7308", barcode: "890730100308", stock: 0 } // Zero stock
        ]
      }
    ]
  },
  {
    productNumber: 4,
    title: "URBAN BOMBER JACKET",
    slug: "urban-bomber-jacket",
    description: "Classic flight bomber jacket with ribbed collar, heavy-duty metallic zip closure, and insulated interior quilted lining.",
    categoryId: "4810670c-52ba-4920-8bc0-01a34078003f", // Jackets
    categoryName: "Jackets",
    subcategoryId: "a0817627-c9dd-442f-bb23-a30544fe41e0", // Bomber
    subcategoryName: "Bomber",
    brandId: "339d61c7-1c68-4b4e-90ff-4423980db346", // POLO
    brandName: "POLO",
    baseMrp: 3999.00,
    basePrice: 2299.00,
    material: "100% Water-Resistant Poly-Twill Shell with Quilted Satin Lining",
    careInstructions: "Dry clean only, do not bleach, do not tumble dry",
    tags: ["jackets", "bomber", "outerwear", "winter", "urban", "menswear"],
    isFeatured: false,
    status: "PUBLISHED",
    colorGroups: [
      {
        colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c",
        colorName: "Burgundy",
        mrp: 3999.00,
        sellingPrice: 2299.00,
        weightGrams: 650,
        lowStockThreshold: 3,
        sizes: [
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "URBANBOM-BURG-M-7401", barcode: "890740100401", stock: 5 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "URBANBOM-BURG-L-7402", barcode: "890740100402", stock: 8 },
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "URBANBOM-BURG-XL-7403", barcode: "890740100403", stock: 4 },
          { sizeId: "b5f1b86c-4968-4ce8-bdcc-0419ddb24509", sizeName: "XXL", sku: "URBANBOM-BURG-XXL-7404", barcode: "890740100404", stock: 1 } // Low stock
        ]
      },
      {
        colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64",
        colorName: "Black",
        mrp: 3999.00,
        sellingPrice: 2299.00,
        weightGrams: 650,
        lowStockThreshold: 3,
        sizes: [
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "URBANBOM-BLAC-M-7405", barcode: "890740100405", stock: 7 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "URBANBOM-BLAC-L-7406", barcode: "890740100406", stock: 10 },
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "URBANBOM-BLAC-XL-7407", barcode: "890740100407", stock: 6 },
          { sizeId: "b5f1b86c-4968-4ce8-bdcc-0419ddb24509", sizeName: "XXL", sku: "URBANBOM-BLAC-XXL-7408", barcode: "890740100408", stock: 3 } // Low stock
        ]
      }
    ]
  },
  {
    productNumber: 5,
    title: "ROYAL HERITAGE KURTA",
    slug: "royal-heritage-kurta",
    description: "Regal long kurta crafted with subtle self-jacquard weave motifs, mandarin collar, and concealed side pockets for festive celebrations.",
    categoryId: "12049325-983c-4240-ab9a-f278d4ba4f33", // Ethnic Wear
    categoryName: "Ethnic Wear",
    subcategoryId: "b3387360-1bb1-46b0-a46c-aafc9f40dee4", // Kurta
    subcategoryName: "Kurta",
    brandId: "613f8ddb-c471-4608-ace2-ced11ab9c7bc", // MenX Sartorial
    brandName: "MenX Sartorial",
    baseMrp: 2999.00,
    basePrice: 1699.00,
    material: "Pure Jacquard Silk-Cotton Blend with Mandarin Collar",
    careInstructions: "Dry clean recommended or gentle hand wash in cold water with mild detergent",
    tags: ["ethnic-wear", "kurta", "traditional", "festive", "silk-blend", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    colorGroups: [
      {
        colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c",
        colorName: "Burgundy",
        mrp: 2999.00,
        sellingPrice: 1699.00,
        weightGrams: 350,
        lowStockThreshold: 4,
        sizes: [
          { sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "ROYALHER-BURG-S-7501", barcode: "890750100501", stock: 6 },
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "ROYALHER-BURG-M-7502", barcode: "890750100502", stock: 11 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "ROYALHER-BURG-L-7503", barcode: "890750100503", stock: 9 },
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "ROYALHER-BURG-XL-7504", barcode: "890750100504", stock: 3 } // Low stock
        ]
      },
      {
        colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b",
        colorName: "Teal",
        mrp: 2999.00,
        sellingPrice: 1699.00,
        weightGrams: 350,
        lowStockThreshold: 4,
        sizes: [
          { sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "ROYALHER-TEAL-S-7505", barcode: "890750100505", stock: 4 },
          { sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "ROYALHER-TEAL-M-7506", barcode: "890750100506", stock: 12 },
          { sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "ROYALHER-TEAL-L-7507", barcode: "890750100507", stock: 8 },
          { sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "ROYALHER-TEAL-XL-7508", barcode: "890750100508", stock: 0 } // Zero stock
        ]
      }
    ]
  }
];

async function validateDataset() {
  console.log('=================================================================');
  console.log('         VALIDATING PROPOSED 5 PRODUCT TEST DATASET              ');
  console.log('=================================================================');

  let errors = [];
  let totalVariants = 0;
  const usedSlugs = new Set();
  const usedSkus = new Set();
  const usedBarcodes = new Set();

  // 1. Fetch live database state for validation
  const { rows: dbCats } = await pool.query('SELECT id, name, slug, is_active FROM categories');
  const { rows: dbSubs } = await pool.query('SELECT id, category_id, name, slug, is_active FROM subcategories');
  const { rows: dbBrands } = await pool.query('SELECT id, name, slug, is_active FROM brands');
  const { rows: dbColors } = await pool.query('SELECT id, name, hex_code FROM colors');
  const { rows: dbSizes } = await pool.query('SELECT id, name, category_type FROM sizes');
  const { rows: dbProds } = await pool.query('SELECT slug FROM products');
  const { rows: dbVariants } = await pool.query('SELECT sku, barcode FROM product_variants');

  const catMap = new Map(dbCats.map(c => [c.id, c]));
  const subMap = new Map(dbSubs.map(s => [s.id, s]));
  const brandMap = new Map(dbBrands.map(b => [b.id, b]));
  const colorMap = new Map(dbColors.map(c => [c.id, c]));
  const sizeMap = new Map(dbSizes.map(s => [s.id, s]));

  const existingDbSlugs = new Set(dbProds.map(p => p.slug));
  const existingDbSkus = new Set(dbVariants.map(v => v.sku));
  const existingDbBarcodes = new Set(dbVariants.map(v => v.barcode));

  console.log(`Checking against:`);
  console.log(`- ${dbCats.length} Categories, ${dbSubs.length} Subcategories, ${dbBrands.length} Brands`);
  console.log(`- ${dbColors.length} Colors, ${dbSizes.length} Sizes`);
  console.log(`- ${existingDbSlugs.size} Existing Product Slugs, ${existingDbSkus.size} Existing SKUs\n`);

  for (const prod of PROPOSED_DATASET) {
    console.log(`Checking Product ${prod.productNumber}: "${prod.title}" (${prod.slug})`);

    // Check Slug format & uniqueness
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(prod.slug)) {
      errors.push(`Product ${prod.productNumber} slug '${prod.slug}' has invalid format`);
    }
    if (existingDbSlugs.has(prod.slug)) {
      errors.push(`Product ${prod.productNumber} slug '${prod.slug}' already exists in database`);
    }
    if (usedSlugs.has(prod.slug)) {
      errors.push(`Product ${prod.productNumber} slug '${prod.slug}' is duplicate within batch`);
    }
    usedSlugs.add(prod.slug);

    // Check Category
    const cat = catMap.get(prod.categoryId);
    if (!cat) {
      errors.push(`Product ${prod.productNumber} categoryId '${prod.categoryId}' does not exist in database`);
    } else if (!cat.is_active) {
      errors.push(`Product ${prod.productNumber} category '${cat.name}' is inactive`);
    }

    // Check Subcategory
    const sub = subMap.get(prod.subcategoryId);
    if (!sub) {
      errors.push(`Product ${prod.productNumber} subcategoryId '${prod.subcategoryId}' does not exist in database`);
    } else if (!sub.is_active) {
      errors.push(`Product ${prod.productNumber} subcategory '${sub.name}' is inactive`);
    } else if (sub.category_id !== prod.categoryId) {
      errors.push(`Product ${prod.productNumber} subcategory '${sub.name}' does NOT belong to category '${cat?.name}'`);
    }

    // Check Brand
    if (prod.brandId) {
      const brand = brandMap.get(prod.brandId);
      if (!brand) {
        errors.push(`Product ${prod.productNumber} brandId '${prod.brandId}' does not exist in database`);
      } else if (!brand.is_active) {
        errors.push(`Product ${prod.productNumber} brand '${brand.name}' is inactive`);
      }
    }

    // Check Product Pricing
    if (typeof prod.baseMrp !== 'number' || prod.baseMrp <= 0) {
      errors.push(`Product ${prod.productNumber} baseMrp must be positive number`);
    }
    if (typeof prod.basePrice !== 'number' || prod.basePrice <= 0) {
      errors.push(`Product ${prod.productNumber} basePrice must be positive number`);
    }
    if (prod.basePrice > prod.baseMrp) {
      errors.push(`Product ${prod.productNumber} basePrice (${prod.basePrice}) exceeds baseMrp (${prod.baseMrp})`);
    }

    // Check Variants
    const prodVariantCombinations = new Set();

    for (const group of prod.colorGroups) {
      // Check Color
      const color = colorMap.get(group.colorId);
      if (!color) {
        errors.push(`Product ${prod.productNumber} colorId '${group.colorId}' does not exist in database`);
      }

      for (const size of group.sizes) {
        totalVariants++;

        // Check Size
        const sizeObj = sizeMap.get(size.sizeId);
        if (!sizeObj) {
          errors.push(`Product ${prod.productNumber} sizeId '${size.sizeId}' does not exist in database`);
        } else {
          // Check Category-Size compatibility
          const isValidSize = isSizeValidForCategory(cat, sizeObj.name, sizeObj.category_type, sub);
          if (!isValidSize) {
            errors.push(`Product ${prod.productNumber}: Size '${sizeObj.name}' (${sizeObj.category_type}) is INVALID for Category '${cat?.name}'`);
          }
        }

        // Check (product, size, color) uniqueness
        const comboKey = `${size.sizeId}:${group.colorId}`;
        if (prodVariantCombinations.has(comboKey)) {
          errors.push(`Product ${prod.productNumber}: Duplicate variant combo for Size ${size.sizeName} and Color ${group.colorName}`);
        }
        prodVariantCombinations.add(comboKey);

        // Check SKU uniqueness
        if (!size.sku || typeof size.sku !== 'string') {
          errors.push(`Product ${prod.productNumber}: Missing or invalid SKU`);
        } else {
          if (existingDbSkus.has(size.sku)) {
            errors.push(`Product ${prod.productNumber}: SKU '${size.sku}' already exists in DB`);
          }
          if (usedSkus.has(size.sku)) {
            errors.push(`Product ${prod.productNumber}: Duplicate SKU '${size.sku}' in batch`);
          }
          usedSkus.add(size.sku);
        }

        // Check Barcode uniqueness
        if (!size.barcode || typeof size.barcode !== 'string') {
          errors.push(`Product ${prod.productNumber}: Missing or invalid barcode`);
        } else {
          if (existingDbBarcodes.has(size.barcode)) {
            errors.push(`Product ${prod.productNumber}: Barcode '${size.barcode}' already exists in DB`);
          }
          if (usedBarcodes.has(size.barcode)) {
            errors.push(`Product ${prod.productNumber}: Duplicate Barcode '${size.barcode}' in batch`);
          }
          usedBarcodes.add(size.barcode);
        }

        // Check Variant Pricing
        if (typeof group.mrp !== 'number' || group.mrp <= 0) {
          errors.push(`Product ${prod.productNumber}: Variant MRP must be positive number`);
        }
        if (typeof group.sellingPrice !== 'number' || group.sellingPrice <= 0) {
          errors.push(`Product ${prod.productNumber}: Variant sellingPrice must be positive number`);
        }
        if (group.sellingPrice > group.mrp) {
          errors.push(`Product ${prod.productNumber}: Variant sellingPrice (${group.sellingPrice}) exceeds MRP (${group.mrp})`);
        }

        // Check Stock
        if (typeof size.stock !== 'number' || !Number.isInteger(size.stock) || size.stock < 0) {
          errors.push(`Product ${prod.productNumber}: Stock for ${size.sizeName} must be a non-negative integer`);
        }
      }
    }
  }

  console.log('=================================================================');
  console.log('                      VALIDATION RESULTS                         ');
  console.log('=================================================================');
  console.log(`Total Products Validated: ${PROPOSED_DATASET.length}`);
  console.log(`Total Variants Validated: ${totalVariants}`);
  console.log(`Total Unique Slugs: ${usedSlugs.size}`);
  console.log(`Total Unique SKUs: ${usedSkus.size}`);
  console.log(`Total Unique Barcodes: ${usedBarcodes.size}`);
  console.log(`Errors Encountered: ${errors.length}`);

  if (errors.length > 0) {
    console.error('\nFAILED CHECKS:');
    errors.forEach(e => console.error(`  [X] ${e}`));
    process.exit(1);
  } else {
    console.log('\n[PASS] All 12 validation rules PASSED with 0 errors.');
    console.log('[PASS] 0 new categories, brands, colors, or sizes required.');
    console.log('[PASS] 100% of IDs match active records in the live database.');
  }
}

validateDataset().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
