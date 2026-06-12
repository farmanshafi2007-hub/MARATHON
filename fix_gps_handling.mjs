import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const result = gpsEngineRef\.current\.processPoint\(p\);[\s\S]*?}, \(error\)/m;

const replacement = `const result = gpsEngineRef.current.processPoint(p);
                
                if (result.status === 'POOR_SIGNAL' || result.status === 'LOW_ACCURACY') {
                    setGpsStatus("POOR SIGNAL");
                    return;
                }
                if (result.status === 'LOCKING') {
                    setGpsStatus("CALIBRATING GPS...");
                    return;
                }
                if (result.status === 'STATIONARY') {
                    setGpsStatus("STATIONARY");
                    runDataRef.current.speed = 0;
                    return;
                }
                if (result.status === 'Signal Lost' || result.status === 'INVALID_TIME') return;
                
                if (result.status === 'MOVING') {
                    setGpsStatus("RECORDING ELITE RUN");
                    runDataRef.current.distance = result.distance;
                    runDataRef.current.speed = result.speed;
                    if (result.coords) {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                }
            }, (error)`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);
