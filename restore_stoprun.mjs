import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const stopRun = async \(\) => \{[\s\S]*?setIsRunning\(false\);\n    \};/m;

const replacement = `const stopRun = async () => { 
        releaseWakeLock();
        triggerVibration('STOP'); // Brutalist confirmation pattern
        if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
        if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
        
        const finalDistance = runDataRef.current.distance;
        const finalElapsed = Math.max(0, Math.floor(runDataRef.current.movingMs / 1000));
        
        const finalDistanceKm = finalDistance / 1000;
        const paceString = formatPace(finalElapsed, finalDistance);

        // Standardize coordinates path
        const finalCoords = runDataRef.current.coordinates.length > 0 
            ? runDataRef.current.coordinates 
            : [];

        if (finalDistance >= 0 && user) { 
            const activityLabel = workoutType === 'run' ? "Run" : "Walk";
            const defaultName = \`\${activityLabel} \${new Date().toLocaleDateString()}\`;
            // Do not prompt if distance is 0, since that acts as an easy abort
            const runName = finalDistance > 0 ? prompt(\`Excellent Session! Name your \${activityLabel}:\`, defaultName) : defaultName;
            
            // Only save if the user didn't cancel the prompt or distance > 0
            if (runName !== null) {
                const summary = { 
                    id: Date.now(), 
                    name: runName || \`\${activityLabel} Session\`,
                    timestamp: Date.now(), 
                    duration: finalElapsed, 
                    distance: finalDistance, 
                    pace: paceString,
                    type: workoutType,
                    coordinates: finalCoords
                };
                
                setLastSummary(summary);
                
                const updatedStreak = (userData?.streak || 0) + 1;
                const updatedTotalKm = (userData?.totalKm || 0) + finalDistanceKm;
                const updatedProfile = { ...userData, streak: updatedStreak, totalKm: updatedTotalKm };
                setUserData(updatedProfile);
                
                try {
                  localStorage.setItem(\`user_profile_\${user.uid}\`, JSON.stringify(updatedProfile));
                  const newRuns = [{ id: String(summary.id), ...summary }, ...runs];
                  setRuns(newRuns);
                  localStorage.setItem(\`user_runs_\${user.uid}\`, JSON.stringify(newRuns));
                } catch (e) {}

                if (db) {
                    try {
                      // These variables need window / global scope correctly handled, we assume doc/updateDoc exist
                      if (typeof updateDoc !== 'undefined' && typeof doc !== 'undefined' && typeof setDoc !== 'undefined' && typeof collection !== 'undefined') {
                          const userDocRef = doc(db, 'users', user.uid);
                          updateDoc(userDocRef, {
                              streak: updatedStreak,
                              totalKm: updatedTotalKm,
                              lastRunDate: new Date().toISOString()
                          }).catch(e => console.log(e));
                          
                          const runDocRef = doc(collection(db, 'users', user.uid, 'runs'), String(summary.id));
                          setDoc(runDocRef, summary).catch(e => console.log(e));
                      }
                    } catch (e) {
                      console.log(e);
                    }
                }
            }
        }
        setIsRunning(false);
    };`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
