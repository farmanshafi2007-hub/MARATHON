import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix Map container
content = content.replace(
    /<div id="gps-vector-map-backdrop" className="opacity-fade-in absolute inset-x-0 top-0 h-\[45%\] w-full overflow-hidden relative select-none">/,
    '<div id="gps-vector-map-backdrop" className="opacity-fade-in relative w-full h-[40vh] shrink-0 overflow-hidden select-none">'
);

// Fix Workout dashboard card
content = content.replace(
    /style=\{\{ minHeight: "60vh", flex: "1 1 auto", overflowY: "auto" \}\}/,
    'style={{ flex: "1 1 auto", overflowY: "auto" }}'
);

fs.writeFileSync('src/App.tsx', content);
