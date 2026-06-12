import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const updateUiRegex = /const updateUI = useCallback\(\(\) => \{[\s\S]*?rAFRef\.current = requestAnimationFrame\(updateUI\);\n    \}, \[\]\);/m;

const newUpdateUi = `const updateUI = useCallback(() => {
        const now = Date.now();
        const dt = now - runDataRef.current.lastTick;
        runDataRef.current.lastTick = now;

        // Keep time running unless manually paused
        if (!isPausedRef.current) {
             runDataRef.current.movingMs += dt;
        }

        if (now - runDataRef.current.lastUiUpdate >= 250) {
            setElapsed(Math.max(0, Math.floor(runDataRef.current.movingMs / 1000)));
            setDistance(runDataRef.current.distance);
            setCurrentSpeed(runDataRef.current.speed);
            runDataRef.current.lastUiUpdate = now;
        }
        rAFRef.current = requestAnimationFrame(updateUI);
    }, []);`;

content = content.replace(updateUiRegex, newUpdateUi);
fs.writeFileSync('src/App.tsx', content);
