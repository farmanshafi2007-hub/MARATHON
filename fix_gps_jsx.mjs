import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /{isPaused \? 'PAUSED' : \(gpsStatus === 'GPS READY'.*?\)}/m;

content = content.replace(regex, "{isPaused ? 'PAUSED' : gpsStatus}");

fs.writeFileSync('src/App.tsx', content);
