import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const importRegex = /setDoc,\s*getDoc,/m;

content = content.replace(importRegex, 'setDoc, getDoc, updateDoc,');

fs.writeFileSync('src/App.tsx', content);
