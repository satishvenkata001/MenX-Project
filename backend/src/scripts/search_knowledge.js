import fs from 'fs';
import path from 'path';
import os from 'os';

const appDataDir = path.join(os.homedir(), '.gemini', 'antigravity-ide');
const knowledgeDir = path.join(appDataDir, 'knowledge');
console.log("Checking Knowledge Directory:", knowledgeDir);

function searchDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Path does not exist: ${dir}`);
    return;
  }
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else {
        if (item.endsWith('.json') || item.endsWith('.md') || item.endsWith('.txt')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('mcvzvgciqmcxqnxuvomw') || content.includes('eyJ') || content.includes('VITE_SUPABASE')) {
            console.log(`Found match in file: ${fullPath}`);
            console.log(content.substring(0, 1000));
            console.log(`-----------------------------------`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`Error searching ${dir}: ${e.message}`);
  }
}

searchDir(knowledgeDir);
