import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/console\.warn\("Wake Lock Error:", err\);/g, '// console.warn("Wake Lock Error:", err);');
fs.writeFileSync('src/App.tsx', content);
