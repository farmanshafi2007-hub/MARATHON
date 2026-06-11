import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace standard calories
let replaced = content.replace(
    /const computedBurn = Math\.floor\(\(lastSummary\.distance \/ 1000\) \* 72 \* 1\.036\);/g,
    "const computedBurn = Math.floor((lastSummary.distance / 1000) * 72 * (lastSummary.type === 'walk' ? 0.53 : 1.036));"
);

replaced = replaced.replace(
    /const totalCalories = Math\.floor\(runs\.reduce\(\(sum, run\) => sum \+ \(\(\(run\.distance \|\| 0\) \/ 1000\) \* 72 \* 1\.036\), 0\)\);/g,
    "const totalCalories = Math.floor(runs.reduce((sum, run) => sum + (((run.distance || 0) / 1000) * 72 * (run.type === 'walk' ? 0.53 : 1.036)), 0));"
);

replaced = replaced.replace(
    /Math\.floor\(\(lastSummary\.distance\/1000\) \* 72 \* 1\.036\)/g,
    "Math.floor((lastSummary.distance/1000) * 72 * (lastSummary.type === 'walk' ? 0.53 : 1.036))"
);

fs.writeFileSync('src/App.tsx', replaced);
