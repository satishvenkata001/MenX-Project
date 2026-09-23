import { pool } from '../../backend/src/config/db.js';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seed all official India Post Andhra Pradesh PIN codes into delivery_zones table.
 * 
 * Source: Official India Post Andhra Pradesh Directory.
 * Features:
 * - Filters strictly for State: "ANDHRA PRADESH"
 * - Deduplicates post offices sharing the same 6-digit PIN code
 * - Validates exactly 6 numeric digits
 * - Idempotent execution (skips existing PIN codes, prevents duplicate rows)
 * - Preserves existing 534340 configuration
 */
export async function seedAndhraPradeshPincodes() {
  console.log('=== Starting Andhra Pradesh PIN Code Seeding ===');

  // Locate the official India Post dataset
  const dataPath = path.resolve('C:/Users/91938/.gemini/antigravity-ide/brain/8b4e4ce6-d43b-4f1e-840a-975400451af2/scratch/node_modules/india-pincode/data/pincodes.json.gz');
  
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Official India Post dataset file not found at: ${dataPath}`);
  }

  const rawBuffer = fs.readFileSync(dataPath);
  const jsonString = zlib.gunzipSync(rawBuffer).toString('utf-8');
  const allRecords = JSON.parse(jsonString);

  console.log(`Loaded ${allRecords.length} total post office records across India.`);

  // 1. Filter strictly for Andhra Pradesh
  const apRecords = allRecords.filter(r => r.s === 'ANDHRA PRADESH');
  console.log(`Found ${apRecords.length} post office records for ANDHRA PRADESH.`);

  // 2. Deduplicate by unique 6-digit PIN code
  const uniqueApPins = new Map();
  let duplicatesSkipped = 0;
  let invalidSkipped = 0;

  for (const record of apRecords) {
    const pin = String(record.p || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      invalidSkipped++;
      continue;
    }

    if (!uniqueApPins.has(pin)) {
      uniqueApPins.set(pin, {
        pincode: pin,
        district: (record.i || 'Andhra Pradesh').trim(),
        postOffices: [record.o]
      });
    } else {
      duplicatesSkipped++;
      uniqueApPins.get(pin).postOffices.push(record.o);
    }
  }

  console.log(`Unique valid 6-digit Andhra Pradesh PIN codes: ${uniqueApPins.size}`);
  console.log(`Post-office duplicates skipped: ${duplicatesSkipped}`);
  if (invalidSkipped > 0) {
    console.log(`Invalid non-6-digit PIN records skipped: ${invalidSkipped}`);
  }

  // 3. Check existing delivery zones in the database
  const existingRes = await pool.query('SELECT id, pincode_pattern FROM delivery_zones');
  const existingPins = new Set(existingRes.rows.map(r => r.pincode_pattern.trim()));
  console.log(`Existing delivery_zones in database: ${existingPins.size}`);

  // 4. Batch insert missing AP PIN codes
  const client = await pool.connect();
  let insertedCount = 0;
  let alreadyExistingCount = 0;

  try {
    await client.query('BEGIN');

    const BATCH_SIZE = 100;
    const toInsert = [];

    for (const [pin, info] of uniqueApPins.entries()) {
      if (existingPins.has(pin)) {
        alreadyExistingCount++;
        continue;
      }

      const zoneName = `Andhra Pradesh - ${info.district} (${pin})`;
      toInsert.push({
        name: zoneName,
        pincode_pattern: pin,
        base_delivery_charge: 20.00,
        free_delivery_threshold: null,
        estimated_days_min: 5,
        estimated_days_max: 9,
        is_active: true
      });
    }

    console.log(`PIN codes to insert: ${toInsert.length} (Already existing: ${alreadyExistingCount})`);

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((item, idx) => {
        const offset = idx * 7;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
        values.push(
          item.name,
          item.pincode_pattern,
          item.base_delivery_charge,
          item.free_delivery_threshold,
          item.estimated_days_min,
          item.estimated_days_max,
          item.is_active
        );
      });

      const insertQuery = `
        INSERT INTO delivery_zones (
          name,
          pincode_pattern,
          base_delivery_charge,
          free_delivery_threshold,
          estimated_days_min,
          estimated_days_max,
          is_active
        )
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(insertQuery, values);
      insertedCount += batch.length;
    }

    await client.query('COMMIT');
    console.log(`Successfully inserted ${insertedCount} new Andhra Pradesh delivery PIN codes.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 5. Final audit verification
  const totalRes = await pool.query('SELECT COUNT(*) FROM delivery_zones WHERE is_active = true');
  const countActive = parseInt(totalRes.rows[0].count, 10);
  console.log(`Total active delivery zones in database: ${countActive}`);

  return {
    totalRawApRecords: apRecords.length,
    uniqueApPins: uniqueApPins.size,
    duplicatesSkipped,
    alreadyExistingCount,
    insertedCount,
    totalActiveDeliveryZones: countActive
  };
}

// Run directly if called as a script
if (process.argv[1] && process.argv[1].endsWith('seed_andhra_pradesh_pincodes.js')) {
  seedAndhraPradeshPincodes()
    .then((stats) => {
      console.log('Seeding completed successfully:', stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
