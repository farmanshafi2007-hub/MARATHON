import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldLogic = `                if (result.status === 'MOVING' || result.status === 'LOCKED' || result.status === 'STATIONARY') {
                    if (autoPaused) setAutoPaused(false);
                    const oldKm = Math.floor(runDataRef.current.distance / 1000);
                    runDataRef.current.distance = result.distance;
                    runDataRef.current.speed = result.speed || 0;
                    const newKm = Math.floor(runDataRef.current.distance / 1000);
                    if (newKm > oldKm && newKm > 0) {
                        triggerVibration('MILESTONE');
                        setIsMilestonePulse(true);
                        setTimeout(() => setIsMilestonePulse(false), 800);
                    }
                    
                    // Always append coordinate path point securely
                    runDataRef.current.coordinates.push({
                        lat: p.coords.latitude,
                        lng: p.coords.longitude
                    });
                } else if (result.status === 'AUTO_PAUSED') {`;

const newLogic = `                if (result.status === 'MOVING') {
                    if (autoPaused) setAutoPaused(false);
                    const oldKm = Math.floor(runDataRef.current.distance / 1000);
                    runDataRef.current.distance = result.distance;
                    runDataRef.current.speed = result.speed || 0;
                    const newKm = Math.floor(runDataRef.current.distance / 1000);
                    if (newKm > oldKm && newKm > 0) {
                        triggerVibration('MILESTONE');
                        setIsMilestonePulse(true);
                        setTimeout(() => setIsMilestonePulse(false), 800);
                    }
                    
                    if (result.coords) {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                } else if (result.status === 'LOCKED' || result.status === 'STATIONARY') {
                    if (autoPaused) setAutoPaused(false);
                    runDataRef.current.speed = 0;
                    if (result.coords && result.status === 'LOCKED') {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                } else if (result.status === 'AUTO_PAUSED') {`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/App.tsx', content);
