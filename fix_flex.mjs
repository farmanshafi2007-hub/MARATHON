import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The card itself shouldn't scroll, it should just be flex.
content = content.replace(
    /<div id="workout-dashboard-card" className=\{\`relative z-20 \$\{darkMode \? 'bg-\[\#2b2b2c\] text-white' : 'bg-\[\#e0e5ec\] text-\[\#1c1c1e\]'\} rounded-t-\[2\.5rem\] p-6 pb-12 shadow-\[0_-15px_40px_rgba\(0,0,0,0\.15\)\] flex flex-col justify-between\`\} style=\{\{ flex: "1 1 auto", overflowY: "auto" \}\}>/,
    '<div id="workout-dashboard-card" className={`relative z-20 ${darkMode ? \'bg-[#2b2b2c] text-white\' : \'bg-[#e0e5ec] text-[#1c1c1e]\'} rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-15px_40px_rgba(0,0,0,0.15)] flex flex-col justify-between overflow-hidden`} style={{ flex: "1 1 auto" }}>'
);

content = content.replace(
    /<div className="flex-1 flex flex-col justify-between">/,
    '<div className="flex-1 flex flex-col justify-start overflow-y-auto custom-scroll mb-4 shrink pr-1">'
);

content = content.replace(
    /\{\/\* TERTIARY DETAIL STATS ROW \(Calories, Speed, Elevation\) \*\/\}/,
    '{/* TERTIARY DETAIL STATS ROW (Calories, Speed, Elevation) */}\n                        <div className="mt-auto"></div>\n'
);

fs.writeFileSync('src/App.tsx', content);
