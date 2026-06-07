const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) results = results.concat(walk(fullPath));
    else if (file === 'index.ts') results.push(fullPath);
  });
  return results;
}
const files = walk('D:/DEV/Apps/AutaKimi/autakimi-extensions/src/extensions');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from\s+['"]\.\.\/\.\.\/\.\.\/base\//g, 'from \'../../../../base/');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}
