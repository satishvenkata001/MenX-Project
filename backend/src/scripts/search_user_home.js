import fs from 'fs';
import path from 'path';
import os from 'os';

const homeDir = os.homedir();
console.log("User home directory:", homeDir);

const checkPaths = [
  path.join(homeDir, '.supabase'),
  path.join(homeDir, 'AppData', 'Local', 'supabase'),
  path.join(homeDir, 'AppData', 'Roaming', 'supabase'),
  path.join('d:', 'MenX', '.supabase'),
  path.join('d:', 'MenX', 'backend', '.supabase'),
  path.join('d:', 'MenX', 'frontend', '.supabase'),
];

function searchDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Path does not exist: ${dir}`);
    return;
  }
  console.log(`\n=== Listing contents of: ${dir} ===`);
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`[DIR]  ${item}`);
        // Recursively list if it's not a huge folder
        if (item !== 'node_modules' && item !== '.git') {
          searchDir(fullPath);
        }
      } else {
        console.log(`[FILE] ${item} (${stat.size} bytes)`);
        if (item.includes('ref') || item.includes('config') || item.includes('env') || item.includes('token') || item.includes('key')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            console.log(`--- Content of ${item} ---`);
            console.log(content.substring(0, 500));
            console.log(`--------------------------`);
          } catch (e) {
            console.log(`Failed to read file ${item}: ${e.message}`);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to list ${dir}: ${e.message}`);
  }
}

for (const p of checkPaths) {
  searchDir(p);
}
