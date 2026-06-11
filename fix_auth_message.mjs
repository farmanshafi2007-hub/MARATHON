import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    /setAuthError\(\`Action Required: Please add BOTH "forgesoftwares\.in" AND "\$\{window\.location\.hostname\}" to your Firebase Console[^\`]+\`\);/g,
    'setAuthError(`Action Required: Please add "${window.location.hostname}" to your Firebase Console (Authentication > Settings > Authorized domains). If you are in the preview, open the app in a New Tab to sign in.`);'
);

fs.writeFileSync('src/App.tsx', content);
