const fs = require('fs');
const path = require('path');

const EXT_DIR = path.join(__dirname, 'autakimi-extensions');
const SRC_EXT_DIR = path.join(EXT_DIR, 'src', 'extensions');
const OLD_ICONS_DIR = path.join(EXT_DIR, 'icons');

if (!fs.existsSync(OLD_ICONS_DIR)) {
  console.log('No icons/ directory found.');
  process.exit(0);
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file === 'index.ts') {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk(SRC_EXT_DIR);
let moved = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const pkgMatch = content.match(/"?pkg"?:\s*['"]([^'"]+)['"]/);
  if (!pkgMatch) continue;
  
  const pkg = pkgMatch[1];
  const oldIconPath = path.join(OLD_ICONS_DIR, `${pkg}.png`);
  
  if (fs.existsSync(oldIconPath)) {
    const newIconPath = path.join(path.dirname(file), 'icon.png');
    // Move the file
    fs.renameSync(oldIconPath, newIconPath);
    moved++;
  }
}

console.log(`Successfully moved ${moved} icons to their respective directories.`);
