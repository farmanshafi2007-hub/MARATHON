import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const modalRegex = /if \(lastSummary && !isRunning\) \{[\s\S]*?return \([\s\S]*?<div id="workout-summary-container"[\s\S]*?<\/div>\s*\);\s*\}/m;

const replacement = `if (lastSummary && !isRunning) {
            return (
                <div id="workout-summary-container" className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 w-full h-full">
                    <div className="bg-[#1c1c1e] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-white/10 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-[#34c759]/20 text-[#34c759] rounded-full flex items-center justify-center mb-4">
                            <Flame size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">Run Completed</h2>
                        <p className="text-slate-400 text-sm mb-6">Great job. Here's your summary.</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full mb-6">
                            <div className="bg-[#2a2b2f] p-4 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Distance</p>
                                <p className="text-xl font-bold text-white">
                                    {lastSummary.distance < 1000 ? \`\${Math.floor(lastSummary.distance)}m\` : \`\${(lastSummary.distance/1000).toFixed(2)}km\`}
                                </p>
                            </div>
                            <div className="bg-[#2a2b2f] p-4 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time</p>
                                <p className="text-xl font-bold text-white">{formatTime(lastSummary.duration)}</p>
                            </div>
                        </div>

                        <div className="flex w-full gap-3 mb-4">
                            <button 
                                onClick={() => generateShareCard()}
                                className="flex-1 py-3.5 bg-[#34c759] hover:bg-[#2dae4f] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors"
                            >
                                <Upload size={14} className="rotate-180" /> Share
                            </button>
                            <label className="flex-1 py-3.5 bg-[#2a2b2f] hover:bg-[#323439] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-2 transition-colors cursor-pointer border border-white/5">
                                <input 
                                    type="file" 
                                    accept="image/png, image/jpeg, image/jpg" 
                                    className="hidden" 
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            generateShareCard(e.target.files[0]);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                                <Camera size={14} /> + Photo
                            </label>
                        </div>

                        <button 
                            onClick={() => { setLastSummary(null); setView('home'); }} 
                            className="w-full py-3.5 bg-transparent text-slate-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }`;

content = content.replace(modalRegex, replacement);

fs.writeFileSync('src/App.tsx', content);
