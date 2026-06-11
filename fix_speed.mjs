import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update getGpsDotColor and label to handle AUTO-PAUSED status
content = content.replace(
    /const getGpsDotColor = \(\) => \{/,
    `const getGpsDotColor = () => {
            if (autoPaused) return "bg-amber-500";`
);

content = content.replace(
    /<span className=\{\`w-0\.75 h-2\.5 rounded-xs \$\{gpsStatus === 'RECORDING' \? getGpsDotColor\(\) : 'bg-slate-300'\}\`\} \/>/,
    `<span className={\`w-0.75 h-2.5 rounded-xs \${gpsStatus === 'RECORDING' && !autoPaused ? getGpsDotColor() : 'bg-slate-300'}\`} />`
);

content = content.replace(
    /<span className="text-\[10px\] font-black uppercase tracking-wider font-sans">\s*GPS\s*<\/span>/,
    `<span className="text-[10px] font-black uppercase tracking-wider font-sans">
                                {autoPaused ? 'PAUSED' : 'GPS'}
                            </span>`
);

// Fix SPEED to display current speed instead of average speed
content = content.replace(
    /\{distance > 0 && elapsed > 0 \? \(\(distance \/ Math\.max\(1, elapsed\)\) \* 3\.6\)\.toFixed\(1\) : "0\.0"\}/,
    `{(!autoPaused && currentSpeed > 1.5) ? currentSpeed.toFixed(1) : "0.0"}`
);

fs.writeFileSync('src/App.tsx', content);
