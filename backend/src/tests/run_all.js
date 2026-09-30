import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  'test_phase4a.js',
  'test_phase4b.js',
  'test_phase4d.js',
  'test_phase4e.js',
  'return.test.js',
  'test_phase4g.js',
  'test_safe_deletion.js',
  'variant_stock.test.js',
  'test_category_persistence.js',
  'test_low_stock_grouping.js',
  'test_category_size_validation.js',
  'test_brand_crud.js',
  'test_order_details_items.js',
  'test_wishlist_catalogue.js',
  'test_category_variant_sizes.js',
  'admin_export.test.js',
  'test_custom_color_selector.js',
  'test_cors_origins.js',
  'test_customer_email_verification_flow.js',
  'test_three_auth_flows.js',
  'test_trust_proxy_and_rate_limit_429.js',
  'test_production_cloudflare_rate_limit.js',
  'test_multi_tier_rate_limit.js',
  'test_bulk_variant_creation.js'
];

async function runTest(file) {
  return new Promise((resolve, reject) => {
    console.log(`\n================================================================`);
    console.log(`RUNNING TEST FILE: ${file}`);
    console.log(`================================================================`);
    
    const nodeEnv = file === 'test_cors_origins.js' ? 'development' : 'test';
    const child = fork(path.join(__dirname, file), [], {
      env: {
        ...process.env,
        NODE_ENV: nodeEnv
      }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[SUCCESS] ${file} passed successfully.`);
        resolve(true);
      } else {
        console.error(`[FAILURE] ${file} failed with exit code ${code}.`);
        resolve(false);
      }
    });
    
    child.on('error', (err) => {
      console.error(`[ERROR] Error forking ${file}:`, err);
      resolve(false);
    });
  });
}

async function main() {
  const results = {};
  let allPassed = true;

  for (const file of testFiles) {
    const passed = await runTest(file);
    results[file] = passed ? 'PASS' : 'FAIL';
    if (!passed) {
      allPassed = false;
    }
  }

  console.log('\n================================================================');
  console.log('                     ALL TESTS SUMMARY');
  console.log('================================================================');
  for (const [file, status] of Object.entries(results)) {
    console.log(`- ${file}: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  }
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

main();
