import fs from 'fs';
import path from 'path';

const tempDir = path.join('d:', 'MenX', 'supabase', '.temp');
console.log("Checking path:", tempDir);

if (fs.existsSync(tempDir)) {
  const items = fs.readdirSync(tempDir);
  console.log("Contents of .temp:", items);
  for (const item of items) {
    const fullPath = path.join(tempDir, item);
    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`--- Content of ${item} ---`);
    console.log(content);
    console.log(`--------------------------`);
  }
} else {
  console.log("Path does not exist.");
}
