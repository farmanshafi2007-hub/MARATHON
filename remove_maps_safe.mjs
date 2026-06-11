import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove google-maps imports
content = content.replace(/import \{ APIProvider, Map, Marker, useMap \} from '@vis\.gl\/react-google-maps';\n/, '');
content = content.replace(/import \{ MapPolyline \} from '\.\/MapPolyline';\n/, '');

// Find AppWrapper
const appWrapperStart = content.indexOf('export default function AppWrapper() {');
const appStart = content.indexOf('function App({ apiKey }: { apiKey: string }) {');

if (appWrapperStart !== -1 && appStart !== -1) {
    const endOfAppStart = appStart + 'function App({ apiKey }: { apiKey: string }) {'.length;
    
    const beforeWrapper = content.substring(0, appWrapperStart);
    const afterAppStart = content.substring(endOfAppStart);
    
    // We also need to remove MapPanner which might be before or after AppWrapper.
    // Let's just remove it blindly.
    const newContent = beforeWrapper + 'export default function App() {' + afterAppStart;
    
    // Remove MapPanner
    const finalContent = newContent.replace(/const MapPanner = \(\{[\s\S]*?return null;\n\s*\};\n/, '');
    
    fs.writeFileSync('src/App.tsx', finalContent);
    console.log("Success");
} else {
    console.error("Tags not found");
}
