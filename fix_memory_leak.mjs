import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add cleanup to useEffect
const cleanupCode = `
    useEffect(() => {
        return () => {
            if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
            if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
            releaseWakeLock();
        };
    }, []);
`;

// Inject into App before the first useEffect
content = content.replace(
    /useEffect\(\(\) => \{ isPausedRef\.current = isPaused; \}, \[isPaused\]\);/,
    `useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);\n${cleanupCode}`
);

fs.writeFileSync('src/App.tsx', content);
