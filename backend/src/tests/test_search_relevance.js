import http from 'http';
import app from '../app.js';
import { CatalogService } from '../services/catalog.service.js';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      console.log(`[TEST SERVER] Running ephemeral test server on port ${port}`);
      resolve();
    });
  });
}

async function closeServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

let passedTests = 0;
let totalTests = 0;

async function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(` [PASS] ${description}`);
  } else {
    console.error(` [FAIL] ${description} ${details ? `— ${details}` : ''}`);
  }
}

async function runSearchRelevanceTests() {
  console.log('================================================================');
  console.log('       MENX SEARCH RELEVANCE & SYNONYM MATCHING TEST SUITE      ');
  console.log('================================================================\n');

  try {
    await startServer();

    // -------------------------------------------------------------
    // 1. SERVICE-LEVEL SEARCH RELEVANCE TESTS
    // -------------------------------------------------------------
    console.log('>>> 1. Core Search Queries via CatalogService');

    // "shirts"
    const rShirts = await CatalogService.listProducts({ search: 'shirts' });
    await assert('Search "shirts" returns 2 shirt products', rShirts.items.length === 2, `got ${rShirts.items.length}`);
    await assert('Search "shirts" has correct pagination total 2', rShirts.pagination.total === 2);

    // "shirt"
    const rShirt = await CatalogService.listProducts({ search: 'shirt' });
    await assert('Search "shirt" (singular) returns 2 shirt products', rShirt.items.length === 2);

    // "men"
    const rMen = await CatalogService.listProducts({ search: 'men' });
    await assert('Search "men" returns relevant menswear products', rMen.items.length >= 2, `got ${rMen.items.length}`);

    // "mens"
    const rMens = await CatalogService.listProducts({ search: 'mens' });
    await assert('Search "mens" returns relevant menswear products', rMens.items.length >= 2);

    // "men's"
    const rMensApos = await CatalogService.listProducts({ search: "men's" });
    await assert('Search "men\'s" returns relevant menswear products', rMensApos.items.length >= 2);

    // "mens shirts"
    const rMensShirts = await CatalogService.listProducts({ search: 'mens shirts' });
    await assert('Search "mens shirts" returns 2 shirt products', rMensShirts.items.length === 2);

    // "men's shirts"
    const rMensAposShirts = await CatalogService.listProducts({ search: "men's shirts" });
    await assert('Search "men\'s shirts" returns 2 shirt products', rMensAposShirts.items.length === 2);

    // "shirts for men"
    const rShirtsForMen = await CatalogService.listProducts({ search: 'shirts for men' });
    await assert('Search "shirts for men" returns 2 shirt products', rShirtsForMen.items.length === 2);

    // "men shirt"
    const rMenShirt = await CatalogService.listProducts({ search: 'men shirt' });
    await assert('Search "men shirt" returns 2 shirt products', rMenShirt.items.length === 2);

    // "male shirts"
    const rMaleShirts = await CatalogService.listProducts({ search: 'male shirts' });
    await assert('Search "male shirts" returns 2 shirt products', rMaleShirts.items.length === 2);

    // -------------------------------------------------------------
    // 2. RELEVANCE RANKING TESTS
    // -------------------------------------------------------------
    console.log('\n>>> 2. Relevance Ranking Order');

    // "oxford shirt" -> Oxford Casual Shirt must be ranked 1st
    const rOxford = await CatalogService.listProducts({ search: 'oxford shirt' });
    await assert('Search "oxford shirt" returns products', rOxford.items.length >= 1);
    await assert('Search "oxford shirt" ranks Oxford Casual Shirt 1st', rOxford.items[0]?.title?.includes('OXFORD'));

    // "formal shirt" -> Slim Fit Formal Shirt must be ranked 1st
    const rFormal = await CatalogService.listProducts({ search: 'formal shirt' });
    await assert('Search "formal shirt" returns products', rFormal.items.length >= 1);
    await assert('Search "formal shirt" ranks Formal Shirt 1st', rFormal.items[0]?.title?.includes('FORMAL'));

    // -------------------------------------------------------------
    // 3. CATEGORY & EDGE CASE QUERIES
    // -------------------------------------------------------------
    console.log('\n>>> 3. Category Queries & Edge Cases');

    // "jeans" -> 0 products (none in catalog yet, but no crashes)
    const rJeans = await CatalogService.listProducts({ search: 'jeans' });
    await assert('Search "jeans" returns 0 products without error', rJeans.items.length === 0);

    // "mens jeans"
    const rMensJeans = await CatalogService.listProducts({ search: 'mens jeans' });
    await assert('Search "mens jeans" returns 0 products without error', rMensJeans.items.length === 0);

    // "trousers"
    const rTrousers = await CatalogService.listProducts({ search: 'trousers' });
    await assert('Search "trousers" returns 0 products without error', rTrousers.items.length === 0);

    // "t-shirts"
    const rTShirts = await CatalogService.listProducts({ search: 't-shirts' });
    await assert('Search "t-shirts" returns 0 products without error', rTShirts.items.length === 0);

    // "footwear"
    const rFootwear = await CatalogService.listProducts({ search: 'footwear' });
    await assert('Search "footwear" returns 0 products without error', rFootwear.items.length === 0);

    // "accessories"
    const rAccessories = await CatalogService.listProducts({ search: 'accessories' });
    await assert('Search "accessories" returns 0 products without error', rAccessories.items.length === 0);

    // "random unrelated query"
    const rRandom = await CatalogService.listProducts({ search: 'random unrelated query xyzabc' });
    await assert('Search "random unrelated query" returns 0 products', rRandom.items.length === 0);

    // Empty string
    const rEmpty = await CatalogService.listProducts({ search: '' });
    await assert('Empty search query returns all published products', rEmpty.items.length >= 2);

    // Spaces only
    const rSpaces = await CatalogService.listProducts({ search: '   ' });
    await assert('Spaces-only search query returns all published products', rSpaces.items.length >= 2);

    // Uppercase with leading/trailing spaces
    const rCaseSpace = await CatalogService.listProducts({ search: '  SHIRTS  ' });
    await assert('Search "  SHIRTS  " (uppercase + spaces) returns 2 shirts', rCaseSpace.items.length === 2);

    // Exact title
    const rExactTitle = await CatalogService.listProducts({ search: 'SLIIM FIT FORMAL SHIRT' });
    await assert('Exact product title search returns product', rExactTitle.items.length >= 1 && rExactTitle.items[0].title === 'SLIIM FIT FORMAL SHIRT');

    // -------------------------------------------------------------
    // 4. SEARCH + FILTER COMBINATIONS
    // -------------------------------------------------------------
    console.log('\n>>> 4. Search Combined with Filters');

    // Search + Category filter
    const rSearchCat = await CatalogService.listProducts({ search: 'shirt', category: 'shirts' });
    await assert('Search "shirt" + category="shirts" returns 2 shirts', rSearchCat.items.length === 2);

    // Search + Subcategory filter
    const rSearchSubcat = await CatalogService.listProducts({ search: 'shirt', subcategory: 'shirts-formal' });
    await assert('Search "shirt" + subcategory="shirts-formal" returns 1 formal shirt', rSearchSubcat.items.length === 1 && rSearchSubcat.items[0].title.includes('FORMAL'));

    // Search + Price filter (matching)
    const rSearchPriceMatch = await CatalogService.listProducts({ search: 'shirts', minPrice: 400, maxPrice: 600 });
    await assert('Search "shirts" + price 400-600 returns 2 shirts', rSearchPriceMatch.items.length === 2);

    // Search + Price filter (non-matching)
    const rSearchPriceNonMatch = await CatalogService.listProducts({ search: 'shirts', minPrice: 1000 });
    await assert('Search "shirts" + minPrice=1000 returns 0 shirts', rSearchPriceNonMatch.items.length === 0);

    // Search + Explicit Sort By name-asc
    const rSortNameAsc = await CatalogService.listProducts({ search: 'shirts', sortBy: 'name-asc' });
    await assert('Search + sortBy="name-asc" sorts alphabetically', rSortNameAsc.items[0]?.title?.startsWith('OXFORD') && rSortNameAsc.items[1]?.title?.startsWith('SLIIM'));

    // Search + Explicit Sort By name-desc
    const rSortNameDesc = await CatalogService.listProducts({ search: 'shirts', sortBy: 'name-desc' });
    await assert('Search + sortBy="name-desc" sorts reverse alphabetically', rSortNameDesc.items[0]?.title?.startsWith('SLIIM') && rSortNameDesc.items[1]?.title?.startsWith('OXFORD'));

    // Search + Pagination
    const rPage1 = await CatalogService.listProducts({ search: 'shirts', page: 1, limit: 1 });
    await assert('Search + page 1 limit 1 returns 1 item', rPage1.items.length === 1);
    await assert('Pagination metadata on page 1 is accurate', rPage1.pagination.total === 2 && rPage1.pagination.totalPages === 2 && rPage1.pagination.hasNextPage === true);

    const rPage2 = await CatalogService.listProducts({ search: 'shirts', page: 2, limit: 1 });
    await assert('Search + page 2 limit 1 returns 2nd item', rPage2.items.length === 1);
    await assert('Pagination metadata on page 2 is accurate', rPage2.pagination.page === 2 && rPage2.pagination.hasPrevPage === true && rPage2.pagination.hasNextPage === false);
    await assert('Page 1 and Page 2 items are distinct (no duplicates)', rPage1.items[0].id !== rPage2.items[0].id);

    // -------------------------------------------------------------
    // 5. HTTP ENDPOINT SEARCH VERIFICATION
    // -------------------------------------------------------------
    console.log('\n>>> 5. HTTP Endpoint GET /api/v1/products?search=...');

    const resShirts = await fetch(`${baseUrl}/products?search=${encodeURIComponent('shirts')}`);
    const dataShirts = await resShirts.json();
    await assert('HTTP GET /products?search=shirts returns 200', resShirts.status === 200);
    await assert('HTTP GET /products?search=shirts returns 2 products', dataShirts.data?.length === 2);
    await assert('HTTP response contains expected pagination structure', typeof dataShirts.meta?.total === 'number');

    const resMensShirts = await fetch(`${baseUrl}/products?search=${encodeURIComponent("men's shirts")}`);
    const dataMensShirts = await resMensShirts.json();
    await assert('HTTP GET /products?search=men\'s shirts returns 2 products', dataMensShirts.data?.length === 2);

    const resShirtsForMen = await fetch(`${baseUrl}/products?search=${encodeURIComponent('shirts for men')}`);
    const dataShirtsForMen = await resShirtsForMen.json();
    await assert('HTTP GET /products?search=shirts for men returns 2 products', dataShirtsForMen.data?.length === 2);

    const resMen = await fetch(`${baseUrl}/products?search=${encodeURIComponent('men')}`);
    const dataMen = await resMen.json();
    await assert('HTTP GET /products?search=men returns relevant menswear products', dataMen.data?.length >= 2);

    // -------------------------------------------------------------
    // 6. CONTRACT & NO-DUPLICATES VALIDATION
    // -------------------------------------------------------------
    console.log('\n>>> 6. API Response Contract & Data Integrity');

    const sampleProduct = dataShirts.data[0];
    await assert('Product has valid id', typeof sampleProduct.id === 'string');
    await assert('Product has valid slug', typeof sampleProduct.slug === 'string');
    await assert('Product has valid price object with sellingPrice', typeof sampleProduct.price?.sellingPrice === 'number');
    await assert('Product has category object', sampleProduct.category !== null && typeof sampleProduct.category?.name === 'string');
    await assert('Product has brand object', sampleProduct.brand !== null && typeof sampleProduct.brand?.name === 'string');
    await assert('Product has availableSizes array', Array.isArray(sampleProduct.availableSizes));
    await assert('Product has availableColors array', Array.isArray(sampleProduct.availableColors));

    const ids = dataShirts.data.map(p => p.id);
    const uniqueIds = new Set(ids);
    await assert('No duplicate products returned in search results', uniqueIds.size === ids.length);

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await closeServer();
  }
}

runSearchRelevanceTests();
