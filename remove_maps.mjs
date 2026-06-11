import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove google-maps imports
content = content.replace(/import \{ APIProvider, Map, Marker, useMap \} from '@vis\.gl\/react-google-maps';\n/, '');
content = content.replace(/import \{ MapPolyline \} from '\.\/MapPolyline';\n/, '');

// 2. Remove MapPanner
const mapPannerRegex = /    const MapPanner = \(\{[^\}]*\}\) => \{\n(?:[^\n]*\n)*?    \};\n\n/;
content = content.replace(mapPannerRegex, '');

// 3. Remove AppWrapper and replace with simple export default function App()
const appWrapperOldRegex = /export default function AppWrapper\(\) \{[\s\S]*?function App\(\{ apiKey \}: \{ apiKey: string \}\) \{/m;
const newAppDeclaration = `export default function App() {`;

content = content.replace(appWrapperOldRegex, newAppDeclaration);

fs.writeFileSync('src/App.tsx', content);
