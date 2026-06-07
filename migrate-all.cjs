const fs = require('fs');
const path = require('path');

const EXT_DIR = path.join(__dirname, 'autakimi-extensions');
const SRC_EXT_DIR = path.join(EXT_DIR, 'src', 'extensions');

function processCatalog(catalogPath, type) {
  if (!fs.existsSync(catalogPath)) return;
  const files = fs.readdirSync(catalogPath).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(catalogPath, file), 'utf8'));
    for (const ext of data) {
      if (ext.baseClass === 'Native') continue; // Already migrated Native
      
      const lang = ext.lang || 'all';
      // derive name from pkg
      let name = ext.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (ext.pkg) {
        const parts = ext.pkg.split('.');
        name = parts[parts.length - 1];
      }
      
      const dir = path.join(SRC_EXT_DIR, type, lang, name);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const indexPath = path.join(dir, 'index.ts');
      // If we already wrote it, skip
      if (fs.existsSync(indexPath)) continue;

      const code = `export const config = ${JSON.stringify(ext, null, 2)};\n`;
      fs.writeFileSync(indexPath, code, 'utf8');
      console.log(`Migrated ${type}/${lang}/${name}`);
    }
  }
}

// Process Manga
processCatalog(path.join(EXT_DIR, 'MangaCatalogs', 'extensions'), 'manga');
// Process Anime
processCatalog(path.join(EXT_DIR, 'AnimeCatalogs', 'extensions'), 'anime');
