import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/active:scale-95 transition-all/g, 'skeuo-btn');
content = content.replace(/active:scale-95 transition-transform/g, 'skeuo-btn');
fs.writeFileSync('src/App.tsx', content);
