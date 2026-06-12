import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const stopRunRegex = /if \(finalDistance > 5 && user\) \{([\s\S]*?)\} else \{[\s\S]*?alert\("Workout distance too short to save\."\);[\s\S]*?\}/m;

const replacement = `if (finalDistance >= 0 && user) {$1}`;

content = content.replace(stopRunRegex, replacement);

fs.writeFileSync('src/App.tsx', content);
