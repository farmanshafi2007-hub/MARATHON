import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replacements for text minimalism
content = content.replace(/Elite Streak/g, "Streak");
content = content.replace(/Premium Account/g, "Account");
content = content.replace(/Synchronizing Profile\.\.\./g, "Signing In...");
content = content.replace(/Tactical AI Briefing/g, "AI Briefing");
content = content.replace(/Are you sure you want to sign out of your Runo performance profile\?/g, "Sign out?");
content = content.replace(/ELITE METRICS AND GPS SIGNAL CONFIRMED VIA RUNO SYSTEM/g, "");
content = content.replace(/ATHLETE: \$\{userData\?\.name\?\.toUpperCase\(\) \|\| 'FARMAN SHAFI'\}  \|  STREAK: \$\{userData\?\.streak \|\| 24\} DAILY PROTOCOLS/g, "ATHLETE: ${userData?.name?.toUpperCase() || 'FARMAN SHAFI'}  |  STREAK: ${userData?.streak || 24}");
content = content.replace(/PREMIUM SOCIAL TEMPLATE/g, "SHARE CARD");
content = content.replace(/TACTICAL AI ANALYSIS/g, "AI ANALYSIS");
content = content.replace(/INITIATING SENSOR READINGS/g, "Starting...");
content = content.replace(/NOISE/g, "Signal Lost");

// Post-Run Modal Modification
// I need to find the `workout-summary-container` render block inside `if (lastSummary && !isRunning) { return ( ... );}`
// and replace it with a single minimal modal overlay on top of the running map (or just minimal card).
// Wait, the current code returns a full-screen div if `lastSummary && !isRunning`.
// Let's replace the entire `if (lastSummary && !isRunning)` block with a simplified overlay. 
// But wait, it's inside `const RunView = () => {`. 
// If I edit the block: \`if (lastSummary && !isRunning) { return ( ... ) };\` -> \`if (lastSummary && !isRunning) { return ( <div id="workout-summary-container" className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"><div className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10 text-center"><h2 className="text-2xl font-bold text-white mb-6">Run Completed</h2> ... </div></div> ) }\`

fs.writeFileSync('src/App.tsx', content);
