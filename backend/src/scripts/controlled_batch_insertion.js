import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { pool } from '../config/db.js';

const API_BASE = 'http://localhost:5000/api/v1';

const PRODUCTS_DATASET = [
  {
    productNumber: 1,
    title: "AEROFIT PERFORMANCE CREW TEE",
    slug: "aerofit-performance-crew-tee",
    description: "High-performance moisture-wicking athletic crew neck t-shirt designed for gym workouts and everyday comfort.",
    categoryId: "4ecbcec1-19fb-45f1-9bc8-682e26e92814",
    categoryName: "T-Shirts",
    subcategoryId: "31d37980-27ae-4c14-809a-f61e6d7081b3",
    subcategoryName: "Round Neck",
    brandId: "9781e17c-1071-4425-a4c0-ce7cc51ed999",
    brandName: "AeroFit Sport",
    baseMrp: 999.00,
    basePrice: 499.00,
    material: "92% Polyester, 8% Spandex Breathable Knit",
    careInstructions: "Machine wash cold, do not tumble dry, cool iron if needed",
    tags: ["t-shirt", "round-neck", "activewear", "gym", "breathable", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    variants: [
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "AEROFITP-TEAL-S-7101", barcode: "890710100101", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 15 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "AEROFITP-TEAL-M-7102", barcode: "890710100102", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 20 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "AEROFITP-TEAL-L-7103", barcode: "890710100103", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 4 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "AEROFITP-TEAL-XL-7104", barcode: "890710100104", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 12 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "AEROFITP-BLAC-S-7105", barcode: "890710100105", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 10 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "AEROFITP-BLAC-M-7106", barcode: "890710100106", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 25 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "AEROFITP-BLAC-L-7107", barcode: "890710100107", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 18 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "AEROFITP-BLAC-XL-7108", barcode: "890710100108", mrp: 999.00, sellingPrice: 499.00, weightGrams: 200, lowStockThreshold: 5, initialStock: 0 }
    ]
  },
  {
    productNumber: 2,
    title: "CLASSIC SLIM FIT DENIM JEANS",
    slug: "classic-slim-fit-denim-jeans",
    description: "Tailored slim-fit dark washed jeans with premium stretch cotton construction for maximum durability and effortless movement.",
    categoryId: "c812ff12-6fe9-4b49-8a01-340750d3367f",
    categoryName: "Jeans",
    subcategoryId: "c2863186-6bea-485b-a5f9-db419cc7dc91",
    subcategoryName: "Slim Fit",
    brandId: "613f8ddb-c471-4608-ace2-ced11ab9c7bc",
    brandName: "MenX Sartorial",
    baseMrp: 2499.00,
    basePrice: 1499.00,
    material: "98% Cotton Denim, 2% Elastane Stretch",
    careInstructions: "Machine wash inside out in cold water, wash separately, tumble dry low",
    tags: ["jeans", "denim", "slim-fit", "stretch", "casual", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    variants: [
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "ab4fbbef-52c3-4c86-beb1-00715807a6bb", sizeName: "30", sku: "CLASSICS-BLAC-30-7201", barcode: "890720100201", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 8 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "3f106c8c-d7b4-44bb-9073-4e14d9550839", sizeName: "32", sku: "CLASSICS-BLAC-32-7202", barcode: "890720100202", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 14 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "5da9af00-bcd6-48fd-9dcf-36d55e11a49e", sizeName: "34", sku: "CLASSICS-BLAC-34-7203", barcode: "890720100203", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 12 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "38d04fc2-9837-498a-8425-6c4e6daa080d", sizeName: "36", sku: "CLASSICS-BLAC-36-7204", barcode: "890720100204", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 3 },
      { colorId: "792777e2-05d6-47ba-abae-04e32d0f6548", colorName: "Sky Blue", sizeId: "ab4fbbef-52c3-4c86-beb1-00715807a6bb", sizeName: "30", sku: "CLASSICS-SKYB-30-7205", barcode: "890720100205", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 6 },
      { colorId: "792777e2-05d6-47ba-abae-04e32d0f6548", colorName: "Sky Blue", sizeId: "3f106c8c-d7b4-44bb-9073-4e14d9550839", sizeName: "32", sku: "CLASSICS-SKYB-32-7206", barcode: "890720100206", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 10 },
      { colorId: "792777e2-05d6-47ba-abae-04e32d0f6548", colorName: "Sky Blue", sizeId: "5da9af00-bcd6-48fd-9dcf-36d55e11a49e", sizeName: "34", sku: "CLASSICS-SKYB-34-7207", barcode: "890720100207", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 7 },
      { colorId: "792777e2-05d6-47ba-abae-04e32d0f6548", colorName: "Sky Blue", sizeId: "38d04fc2-9837-498a-8425-6c4e6daa080d", sizeName: "36", sku: "CLASSICS-SKYB-36-7208", barcode: "890720100208", mrp: 2499.00, sellingPrice: 1499.00, weightGrams: 550, lowStockThreshold: 4, initialStock: 2 }
    ]
  },
  {
    productNumber: 3,
    title: "LUX SNEAKER LOW TOP",
    slug: "lux-sneaker-low-top",
    description: "Handcrafted minimalistic full-grain leather low-top sneakers equipped with high-density comfort insoles and vulcanized rubber soles.",
    categoryId: "1e6a3082-5bc0-48a6-8d80-0ce4ce6869b5",
    categoryName: "Footwear",
    subcategoryId: "881c5ed3-a51b-49b2-b334-27b7a4c839ab",
    subcategoryName: "Sneakers",
    brandId: "618cb968-ea73-4375-b836-a80053028910",
    brandName: "Lux Classics",
    baseMrp: 3499.00,
    basePrice: 1999.00,
    material: "Full Grain Leather Upper with Cushioned EVA Rubber Outsole",
    careInstructions: "Wipe with a clean damp cloth, use leather conditioner periodically",
    tags: ["footwear", "sneakers", "leather", "casual", "luxury", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    variants: [
      { colorId: "cc0a4930-2e3c-40b2-b8d2-05661b97ef59", colorName: "Silver White", sizeId: "17728e1e-b8f5-4d20-87a1-2c7f918f7680", sizeName: "7", sku: "LUXSNEAK-SILV-7-7301", barcode: "890730100301", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 5 },
      { colorId: "cc0a4930-2e3c-40b2-b8d2-05661b97ef59", colorName: "Silver White", sizeId: "ee0136ae-58e7-4456-acc2-29972593f2ba", sizeName: "8", sku: "LUXSNEAK-SILV-8-7302", barcode: "890730100302", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 8 },
      { colorId: "cc0a4930-2e3c-40b2-b8d2-05661b97ef59", colorName: "Silver White", sizeId: "faf6a686-b3d4-4bf1-97ef-382a137843ba", sizeName: "9", sku: "LUXSNEAK-SILV-9-7303", barcode: "890730100303", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 12 },
      { colorId: "cc0a4930-2e3c-40b2-b8d2-05661b97ef59", colorName: "Silver White", sizeId: "f3f73fd0-6a42-431d-bb8e-467b8ad97076", sizeName: "10", sku: "LUXSNEAK-SILV-10-7304", barcode: "890730100304", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 2 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "17728e1e-b8f5-4d20-87a1-2c7f918f7680", sizeName: "7", sku: "LUXSNEAK-BLAC-7-7305", barcode: "890730100305", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 4 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "ee0136ae-58e7-4456-acc2-29972593f2ba", sizeName: "8", sku: "LUXSNEAK-BLAC-8-7306", barcode: "890730100306", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 10 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "faf6a686-b3d4-4bf1-97ef-382a137843ba", sizeName: "9", sku: "LUXSNEAK-BLAC-9-7307", barcode: "890730100307", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 7 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "f3f73fd0-6a42-431d-bb8e-467b8ad97076", sizeName: "10", sku: "LUXSNEAK-BLAC-10-7308", barcode: "890730100308", mrp: 3499.00, sellingPrice: 1999.00, weightGrams: 750, lowStockThreshold: 3, initialStock: 0 }
    ]
  },
  {
    productNumber: 4,
    title: "URBAN BOMBER JACKET",
    slug: "urban-bomber-jacket",
    description: "Classic flight bomber jacket with ribbed collar, heavy-duty metallic zip closure, and insulated interior quilted lining.",
    categoryId: "4810670c-52ba-4920-8bc0-01a34078003f",
    categoryName: "Jackets",
    subcategoryId: "a0817627-c9dd-442f-bb23-a30544fe41e0",
    subcategoryName: "Bomber",
    brandId: "339d61c7-1c68-4b4e-90ff-4423980db346",
    brandName: "POLO",
    baseMrp: 3999.00,
    basePrice: 2299.00,
    material: "100% Water-Resistant Poly-Twill Shell with Quilted Satin Lining",
    careInstructions: "Dry clean only, do not bleach, do not tumble dry",
    tags: ["jackets", "bomber", "outerwear", "winter", "urban", "menswear"],
    isFeatured: false,
    status: "PUBLISHED",
    variants: [
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "URBANBOM-BURG-M-7401", barcode: "890740100401", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 5 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "URBANBOM-BURG-L-7402", barcode: "890740100402", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 8 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "URBANBOM-BURG-XL-7403", barcode: "890740100403", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 4 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "b5f1b86c-4968-4ce8-bdcc-0419ddb24509", sizeName: "XXL", sku: "URBANBOM-BURG-XXL-7404", barcode: "890740100404", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 1 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "URBANBOM-BLAC-M-7405", barcode: "890740100405", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 7 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "URBANBOM-BLAC-L-7406", barcode: "890740100406", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 10 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "URBANBOM-BLAC-XL-7407", barcode: "890740100407", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 6 },
      { colorId: "e4491e92-8f4e-41a1-a35c-d8b597e65d64", colorName: "Black", sizeId: "b5f1b86c-4968-4ce8-bdcc-0419ddb24509", sizeName: "XXL", sku: "URBANBOM-BLAC-XXL-7408", barcode: "890740100408", mrp: 3999.00, sellingPrice: 2299.00, weightGrams: 650, lowStockThreshold: 3, initialStock: 3 }
    ]
  },
  {
    productNumber: 5,
    title: "ROYAL HERITAGE KURTA",
    slug: "royal-heritage-kurta",
    description: "Regal long kurta crafted with subtle self-jacquard weave motifs, mandarin collar, and concealed side pockets for festive celebrations.",
    categoryId: "12049325-983c-4240-ab9a-f278d4ba4f33",
    categoryName: "Ethnic Wear",
    subcategoryId: "b3387360-1bb1-46b0-a46c-aafc9f40dee4",
    subcategoryName: "Kurta",
    brandId: "613f8ddb-c471-4608-ace2-ced11ab9c7bc",
    brandName: "MenX Sartorial",
    baseMrp: 2999.00,
    basePrice: 1699.00,
    material: "Pure Jacquard Silk-Cotton Blend with Mandarin Collar",
    careInstructions: "Dry clean recommended or gentle hand wash in cold water with mild detergent",
    tags: ["ethnic-wear", "kurta", "traditional", "festive", "silk-blend", "menswear"],
    isFeatured: true,
    status: "PUBLISHED",
    variants: [
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "ROYALHER-BURG-S-7501", barcode: "890750100501", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 6 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "ROYALHER-BURG-M-7502", barcode: "890750100502", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 11 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "ROYALHER-BURG-L-7503", barcode: "890750100503", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 9 },
      { colorId: "1ff96454-ce4a-4e72-adf0-0c1ce5d8ed8c", colorName: "Burgundy", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "ROYALHER-BURG-XL-7504", barcode: "890750100504", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 3 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "d74d596b-d99d-485e-b735-5d9371310b76", sizeName: "S", sku: "ROYALHER-TEAL-S-7505", barcode: "890750100505", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 4 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "cc4d53dc-573e-4075-8d1d-1db852afd888", sizeName: "M", sku: "ROYALHER-TEAL-M-7506", barcode: "890750100506", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 12 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "e08b9eee-7b95-4414-be20-3a1963999df0", sizeName: "L", sku: "ROYALHER-TEAL-L-7507", barcode: "890750100507", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 8 },
      { colorId: "da2eeb9f-2c92-4d17-b28c-7c897902bc0b", colorName: "Teal", sizeId: "98c20009-486f-4471-b539-0435ddcd4963", sizeName: "XL", sku: "ROYALHER-TEAL-XL-7508", barcode: "890750100508", mrp: 2999.00, sellingPrice: 1699.00, weightGrams: 350, lowStockThreshold: 4, initialStock: 0 }
    ]
  }
];

async function runControlledBatchInsertion() {
  console.log('======================================================================');
  console.log('       MENX — CONTROLLED ADMIN BATCH INSERTION (5 CATALOGUES)         ');
  console.log('======================================================================\n');

  // 1. Initial State Check
  const { rows: initialProds } = await pool.query('SELECT id, title, slug, status FROM products ORDER BY created_at ASC');
  const { rows: initialVariants } = await pool.query('SELECT id, sku FROM product_variants');
  const { rows: initialCats } = await pool.query('SELECT COUNT(*)::int as count FROM categories');
  const { rows: initialSubs } = await pool.query('SELECT COUNT(*)::int as count FROM subcategories');
  const { rows: initialBrands } = await pool.query('SELECT COUNT(*)::int as count FROM brands');
  const { rows: initialColors } = await pool.query('SELECT COUNT(*)::int as count FROM colors');
  const { rows: initialSizes } = await pool.query('SELECT COUNT(*)::int as count FROM sizes');

  const initialProductCount = initialProds.length;
  const initialVariantCount = initialVariants.length;

  console.log(`[INITIAL DATABASE STATE]`);
  console.log(`- Products in Database: ${initialProductCount}`);
  console.log(`- Variants in Database: ${initialVariantCount}`);
  console.log(`- Categories: ${initialCats[0].count} | Subcategories: ${initialSubs[0].count}`);
  console.log(`- Brands: ${initialBrands[0].count} | Colors: ${initialColors[0].count} | Sizes: ${initialSizes[0].count}\n`);

  // 2. Obtain Super Admin JWT
  const adminEmail = 'admin.1786782027454@menx.com';
  const tempPassword = 'SuperAdmin!SecurePass2026';
  const authClient = createAuthClient();
  const { data: authRes, error: loginErr } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: tempPassword
  });

  if (loginErr || !authRes?.session?.access_token) {
    console.error('[FATAL AUTH ERROR] Failed to authenticate as Super Admin:', loginErr);
    process.exit(1);
  }

  const token = authRes.session.access_token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const insertedProducts = [];

  // 3. Process Products 1 by 1
  for (const prodData of PRODUCTS_DATASET) {
    console.log(`----------------------------------------------------------------------`);
    console.log(`>>> PROCESSING PRODUCT ${prodData.productNumber}/5: "${prodData.title}"`);
    console.log(`----------------------------------------------------------------------`);

    // STEP 1: CREATE PRODUCT VIA ADMIN API
    const productPayload = {
      title: prodData.title,
      slug: prodData.slug,
      description: prodData.description,
      categoryId: prodData.categoryId,
      subcategoryId: prodData.subcategoryId,
      brandId: prodData.brandId,
      baseMrp: prodData.baseMrp,
      basePrice: prodData.basePrice,
      material: prodData.material,
      careInstructions: prodData.careInstructions,
      tags: prodData.tags,
      isFeatured: prodData.isFeatured,
      status: prodData.status
    };

    console.log(`[Step 1] Calling POST ${API_BASE}/admin/products ...`);
    const prodRes = await fetch(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(productPayload)
    });

    const prodJson = await prodRes.json();
    if (!prodRes.ok || prodRes.status !== 201) {
      console.error(`[FATAL ERROR] Product ${prodData.productNumber} creation failed!`);
      console.error(`HTTP Status: ${prodRes.status}`);
      console.error(`Endpoint: POST ${API_BASE}/admin/products`);
      console.error(`Response:`, JSON.stringify(prodJson, null, 2));
      process.exit(1);
    }

    const createdProduct = prodJson.data;
    const productId = createdProduct.id;
    console.log(`[Step 1 SUCCESS] Product created with ID: ${productId}`);
    console.log(`- Title: "${createdProduct.title}" | Slug: "${createdProduct.slug}"`);
    console.log(`- Category: ${createdProduct.category_id} | Subcategory: ${createdProduct.subcategory_id} | Brand: ${createdProduct.brand_id}`);
    console.log(`- Base MRP: ${createdProduct.base_mrp} | Base Price: ${createdProduct.base_price} | Status: ${createdProduct.status}\n`);

    // STEP 2: CREATE VARIANTS VIA ADMIN API
    console.log(`[Step 2] Creating ${prodData.variants.length} Variants via POST ${API_BASE}/admin/products/${productId}/variants ...`);
    const createdVariants = [];

    for (let i = 0; i < prodData.variants.length; i++) {
      const v = prodData.variants[i];
      const variantPayload = {
        sizeId: v.sizeId,
        colorId: v.colorId,
        sku: v.sku,
        barcode: v.barcode,
        mrp: v.mrp,
        sellingPrice: v.sellingPrice,
        weightGrams: v.weightGrams,
        lowStockThreshold: v.lowStockThreshold,
        initialStock: v.initialStock
      };

      const varRes = await fetch(`${API_BASE}/admin/products/${productId}/variants`, {
        method: 'POST',
        headers,
        body: JSON.stringify(variantPayload)
      });

      const varJson = await varRes.json();
      if (!varRes.ok || varRes.status !== 201) {
        console.error(`[FATAL ERROR] Product ${prodData.productNumber} Variant ${i + 1} (${v.colorName} / ${v.sizeName}) creation failed!`);
        console.error(`HTTP Status: ${varRes.status}`);
        console.error(`Endpoint: POST ${API_BASE}/admin/products/${productId}/variants`);
        console.error(`Payload:`, JSON.stringify(variantPayload, null, 2));
        console.error(`Response:`, JSON.stringify(varJson, null, 2));
        process.exit(1);
      }

      const createdVar = varJson.data;
      createdVariants.push(createdVar);
      console.log(`  [Variant ${i + 1}/${prodData.variants.length}] Created: SKU ${createdVar.sku} | Barcode ${createdVar.barcode} | ${v.colorName} / ${v.sizeName} | Price: ₹${createdVar.selling_price} | Stock: ${createdVar.quantity_available} (${createdVar.availability})`);
    }

    // STEP 3: VERIFY VARIANTS IN DATABASE & API
    console.log(`\n[Step 3] Verifying variants for Product ${prodData.productNumber} ...`);
    const { rows: dbVarRows } = await pool.query(`
      SELECT pv.id, pv.sku, pv.barcode, pv.mrp, pv.selling_price, pv.is_active,
             s.name as size_name, c.name as color_name,
             ii.quantity_available, ii.quantity_reserved, ii.quantity_damaged
      FROM product_variants pv
      JOIN sizes s ON s.id = pv.size_id
      JOIN colors c ON c.id = pv.color_id
      JOIN inventory_items ii ON ii.variant_id = pv.id
      WHERE pv.product_id = $1
      ORDER BY pv.created_at ASC;
    `, [productId]);

    if (dbVarRows.length !== prodData.variants.length) {
      console.error(`[VERIFICATION ERROR] Expected ${prodData.variants.length} variants, found ${dbVarRows.length}`);
      process.exit(1);
    }
    console.log(`[Step 3 SUCCESS] All ${dbVarRows.length} variants verified with matching inventory records.`);

    // STEP 5: PRODUCT-LEVEL VERIFICATION
    console.log(`[Step 5] Product-Level verification for "${prodData.title}" ...`);
    const { rows: prodVerify } = await pool.query(`
      SELECT p.id, p.title, p.slug, p.category_id, p.subcategory_id, p.brand_id, p.base_mrp, p.base_price, p.status,
             c.name as category_name, sc.name as subcategory_name, b.name as brand_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN subcategories sc ON sc.id = p.subcategory_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = $1;
    `, [productId]);

    const pv = prodVerify[0];
    if (!pv || pv.title !== prodData.title || pv.slug !== prodData.slug) {
      console.error(`[VERIFICATION ERROR] Product record mismatch:`, pv);
      process.exit(1);
    }
    console.log(`[Step 5 SUCCESS] Product "${pv.title}" fully verified (Category: ${pv.category_name}, Subcategory: ${pv.subcategory_name}, Brand: ${pv.brand_name}).\n`);

    insertedProducts.push({
      productNumber: prodData.productNumber,
      id: productId,
      title: prodData.title,
      slug: prodData.slug,
      category: pv.category_name,
      subcategory: pv.subcategory_name,
      brand: pv.brand_name,
      variantsCount: dbVarRows.length,
      totalStock: dbVarRows.reduce((acc, row) => acc + (row.quantity_available || 0), 0)
    });
  }

  // FINAL VERIFICATION ACROSS DATABASE
  console.log('======================================================================');
  console.log('                      FINAL SYSTEM VERIFICATION                       ');
  console.log('======================================================================');

  const { rows: finalProds } = await pool.query('SELECT id, title, slug, status, created_at FROM products ORDER BY created_at ASC');
  const { rows: finalVariants } = await pool.query('SELECT sku, barcode FROM product_variants');
  const { rows: finalCats } = await pool.query('SELECT COUNT(*)::int as count FROM categories');
  const { rows: finalSubs } = await pool.query('SELECT COUNT(*)::int as count FROM subcategories');
  const { rows: finalBrands } = await pool.query('SELECT COUNT(*)::int as count FROM brands');
  const { rows: finalColors } = await pool.query('SELECT COUNT(*)::int as count FROM colors');
  const { rows: finalSizes } = await pool.query('SELECT COUNT(*)::int as count FROM sizes');

  // Check duplicate SKUs and barcodes in DB
  const { rows: dupSkus } = await pool.query('SELECT sku, COUNT(*) FROM product_variants GROUP BY sku HAVING COUNT(*) > 1');
  const { rows: dupBarcodes } = await pool.query('SELECT barcode, COUNT(*) FROM product_variants GROUP BY barcode HAVING COUNT(*) > 1');

  // Check invalid relationships
  const { rows: invalidSubcats } = await pool.query(`
    SELECT p.id, p.title FROM products p
    JOIN subcategories s ON s.id = p.subcategory_id
    WHERE s.category_id != p.category_id
  `);

  console.log(`- Original Catalogue Count: ${initialProductCount}`);
  console.log(`- New Products Inserted: ${insertedProducts.length}`);
  console.log(`- Final Total Catalogue Count: ${finalProds.length}`);
  console.log(`- Original Variant Count: ${initialVariantCount}`);
  console.log(`- New Variants Inserted: ${finalVariants.length - initialVariantCount}`);
  console.log(`- Final Total Variant Count: ${finalVariants.length}`);
  console.log(`- New Categories Created: ${finalCats[0].count - initialCats[0].count}`);
  console.log(`- New Subcategories Created: ${finalSubs[0].count - initialSubs[0].count}`);
  console.log(`- New Brands Created: ${finalBrands[0].count - initialBrands[0].count}`);
  console.log(`- New Colors Created: ${finalColors[0].count - initialColors[0].count}`);
  console.log(`- New Sizes Created: ${finalSizes[0].count - initialSizes[0].count}`);
  console.log(`- Duplicate SKUs: ${dupSkus.length}`);
  console.log(`- Duplicate Barcodes: ${dupBarcodes.length}`);
  console.log(`- Invalid Category/Subcategory Relationships: ${invalidSubcats.length}`);

  console.log('\n--- INSERTED CATALOGUES SUMMARY ---');
  console.table(insertedProducts);
  console.log('\n--- ALL CURRENT CATALOGUES IN DATABASE ---');
  console.table(finalProds);
}

runControlledBatchInsertion().then(() => process.exit(0)).catch(err => {
  console.error('[FATAL RUNTIME ERROR]:', err);
  process.exit(1);
});
