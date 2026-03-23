const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'DEV', 'Apps', 'LManwa', 'src', 'renderer', 'src', 'sources', 'Extensions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const cleaned = data.map(ext => ({
    ...ext,
    name: ext.name.replace(/^Tachiyomi:\s*/i, '')
}));

fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
console.log(`Cleaned ${cleaned.length} extensions.`);
