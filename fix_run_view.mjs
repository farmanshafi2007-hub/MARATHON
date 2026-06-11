import fs from 'fs';

const fileContent = fs.readFileSync('src/App.tsx', 'utf8');

const startTag = '        return (\n            <div id="active-workout-view"';
const endTag = '            </div>\n        );\n    };';

const startIndex = fileContent.indexOf(startTag);
if (startIndex === -1) throw new Error('Start tag not found: ' + startTag);

// Find the closure of the Run component
let index = startIndex;
while (index < fileContent.length) {
    if (fileContent.substring(index, index + endTag.length) === endTag) {
        break;
    }
    index++;
}
if (index >= fileContent.length) throw new Error('End tag not found');

const endIndex = index + endTag.length;

const oldReturnStr = fileContent.substring(startIndex, endIndex);

const newReturnStr = `        const formatHugeTimer = (totalSeconds: number) => {
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            return \`\${h.toString().padStart(2, '0')}:\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
        };

        return (
            <div id="active-workout-view" className="absolute inset-0 z-[61] bg-[#0a0f12] text-white flex flex-col justify-between overflow-hidden overscroll-none w-full h-full pb-8">
                {/* Background Particles/Glow */}
                <div className="absolute top-0 inset-x-0 h-64 pointer-events-none opacity-40">
                    <div className="absolute top-[-50px] left-[-20px] w-64 h-64 bg-[#00e5ff]/20 blur-[80px] rounded-full"></div>
                    <div className="absolute top-[-50px] right-[-20px] w-64 h-64 bg-[#0a84ff]/20 blur-[80px] rounded-full"></div>
                </div>

                {/* Main Content Scroll Container */}
                <div className="flex-1 overflow-y-auto custom-scroll w-full flex flex-col items-center pt-10 px-5 pb-[140px] z-10">
                    
                    {/* Header */}
                    <div className="w-full flex justify-between items-center mb-4">
                        <div className="bg-[#34c759] rounded-full px-3.5 py-1 font-bold text-white text-[12px] shadow-sm tracking-wide leading-none">
                            {(new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-100">
                            {/* Dummy iOS signal icons */}
                            <svg width="18" height="12" viewBox="0 0 16 12" fill="white"><path d="M1 10h2V2H1v8zm4 0h2V5H5v5zm4 0h2V2H9v8zm4 0h2V0h-2v10z"/></svg>
                            <span className="text-[12px] font-bold font-sans tracking-wide">5G</span>
                            <div className="relative w-[28px] h-[14px] border border-white rounded-[4px] p-[1px] ml-1 opacity-90">
                                <div className="absolute right-[-4px] top-[3px] w-[3px] h-1.5 bg-white border border-white rounded-r-md"></div>
                                <div className="h-full bg-white rounded-[2px]" style={{width: '75%'}}></div>
                            </div>
                        </div>
                    </div>

                    {/* Timer Section */}
                    <div className="w-full relative flex flex-col items-center mb-8">
                        <div className="absolute right-0 top-0 p-2 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </div>
                        <p className={\`text-base font-bold mb-1 \${gpsStatus === 'RECORDING' && !autoPaused ? 'text-[#34c759]' : (autoPaused ? 'text-amber-500' : 'text-slate-400')}\`}>
                            {gpsStatus === 'RECORDING' && !autoPaused ? 'GPS Acquired' : (autoPaused ? 'Auto Paused' : gpsStatus)}
                        </p>
                        <h1 className="text-[4.5rem] leading-[1.1] font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#34c759] via-[#00e5ff] to-[#0a84ff] mt-0 drop-shadow-[0_2px_15px_rgba(52,199,89,0.2)]">
                            {formatHugeTimer(elapsed)}
                        </h1>
                    </div>

                    {/* Circular Distance Vector */}
                    <div className="relative w-64 h-64 flex items-center justify-center shrink-0 mb-8 mt-2 mx-auto">
                        {/* Outer Multi-color Ring */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                            <defs>
                                <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#0ef071" />
                                    <stop offset="100%" stopColor="#0a84ff" />
                                </linearGradient>
                                <linearGradient id="ringGrad2" x1="0%" y1="100%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#c528f2" />
                                    <stop offset="100%" stopColor="#31d167" />
                                </linearGradient>
                            </defs>
                            {/* Top arc */}
                            <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke="url(#ringGrad1)" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Bottom arc */}
                            <path d="M 10,50 A 40,40 0 0,0 90,50" fill="none" stroke="url(#ringGrad2)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>

                        {/* Inner dotted/solid ring */}
                        <div className="absolute inset-[15px] rounded-full border-[2px] border-white/10"></div>
                        <div className="absolute inset-[22px] rounded-full border-[1.5px] border-[#34c759]/40" style={{ borderStyle: 'dotted' }}></div>

                        {/* Center Content */}
                        <div className="flex flex-col items-center justify-center relative translate-y-[-5px]">
                            {/* Runner Icon */}
                            <div className="relative flex items-center justify-center mt-2 opacity-100">
                                <span className="absolute w-[60px] h-[1px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent bottom-0 left-[-10px] transform -translate-x-1/4 opacity-60 blur-[1px]"></span>
                                <span className="absolute w-[40px] h-[1px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent bottom-2 left-[-5px] transform -translate-x-1/2 opacity-40 blur-[1px]"></span>
                                {workoutType === 'run' ? <Flame size={32} className="text-[#a8ff78] drop-shadow-[0_0_12px_rgba(52,199,89,0.8)] fill-[#a8ff78]" /> : <Navigation size={32} className="text-[#00e5ff] drop-shadow-[0_0_12px_rgba(0,229,255,0.8)] fill-[#00e5ff]" />}
                            </div>
                            
                            {/* Huge Distance Value */}
                            <div className="text-[6rem] leading-[1] font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#ff8c00] via-[#ff2d55] to-[#0a84ff] drop-shadow-[0_2px_20px_rgba(255,45,85,0.2)] mt-1 mb-1">
                                {displayDistance}
                            </div>
                            
                            <div className="text-neutral-300 font-semibold text-sm tracking-wide">
                                Distance ({displayUnit})
                            </div>
                        </div>
                    </div>

                    {/* Avg Pace Pill */}
                    <div className="flex items-center gap-2.5 bg-[#141518]/90 backdrop-blur-xl rounded-full px-5 py-2 mb-10 border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                        <div className="text-[#a8ff78] bg-white/5 p-[5px] rounded-full relative">
                            <Clock size={16} />
                            <div className="absolute bottom-[-1px] right-[-1px] bg-[#34c759] w-2 h-2 rounded-full border border-[#141518]"></div>
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest leading-none mb-1">Avg. pace (/{displayUnit})</span>
                            <span className="text-slate-100 font-bold leading-none text-sm">{formatPace(elapsed, distance).replace(':', "'")}"</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 w-full mb-10 px-0.5">
                        {/* Heart Rate */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={20} className="text-[#ff9500]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Heart Rate</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5">
                                <span className="text-3xl font-bold text-[#ff9500] leading-none">0</span>
                                <span className="text-xs text-slate-500 font-semibold mb-1">bpm</span>
                            </div>
                        </div>
                        {/* Calories */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Flame size={20} className="text-[#ff453a]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Calories</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5">
                                <span className="text-3xl font-bold text-[#ff453a] leading-none">
                                    {workoutType === 'walk' ? Math.max(0, Math.floor((distance / 1000) * 72 * 0.53)) : Math.max(0, Math.floor((distance / 1000) * 72 * 1.036))}
                                </span>
                                <span className="text-xs text-slate-500 font-semibold mb-1">kcal</span>
                            </div>
                        </div>
                        {/* Duration */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock size={20} className="text-[#0a84ff]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Duration</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-[26px] font-bold text-[#0a84ff] tracking-tight leading-none tabular-nums">{formatTime(elapsed).substring(0, 5)}</span>
                                <span className="text-xs text-slate-500 font-semibold mb-1">min</span>
                            </div>
                        </div>
                    </div>

                    {/* Splits Section */}
                    <div className="w-full">
                        <div className="flex justify-between items-center mb-3 px-1">
                            <h3 className="text-[15px] font-bold text-white tracking-wide">Splits (km)</h3>
                            <div className="p-1.5 bg-[#1c1d21] rounded-lg border border-white/10 shadow-sm cursor-pointer hover:bg-white/10 transition-colors">
                                <BarChart2 size={16} className="text-[#0a84ff]" />
                            </div>
                        </div>
                        <div className="bg-[#141518]/60 backdrop-blur-md rounded-[1.5rem] pt-5 border border-white/5 shadow-xl pb-2">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 tracking-wider mb-5 px-5">
                                <span className="w-10 text-left">KM</span>
                                <span className="flex-1 text-left pl-2">PACE (/KM)</span>
                                <span className="w-16 text-right">TIME</span>
                            </div>
                            <div className="flex flex-col gap-4 px-5 pb-4">
                                {getSplitsList().map((split, i) => (
                                    <div key={split.km} className="flex items-center text-sm font-bold text-white">
                                        <span className="w-10 text-left text-[17px] font-black" style={{color: i===0?'#34c759':i===1?'#00e5ff':'#af52de'}}>{split.km}</span>
                                        <div className="flex-1 flex items-center pr-2">
                                            <div className="flex h-[10px] bg-[#1c1d21] rounded-r-lg w-full overflow-hidden shrink-0 max-w-[150px] shadow-inner">
                                                <div className="h-full rounded-r-lg shadow-[inset_0_1px_3px_rgba(255,255,255,0.2)]" style={{
                                                    width: split.pace === "--:--" ? "0%" : (Math.max(10, 80 - i * 15)) + "%", 
                                                    background: i===0?'linear-gradient(90deg, #a8ff78 0%, #78ffd6 100%)':i===1?'linear-gradient(90deg, #00e5ff 0%, #1200ff 100%)':'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)'
                                                }}></div>
                                            </div>
                                        </div>
                                        <span className="w-16 text-right text-slate-300 font-semibold tracking-tight tabular-nums">{split.pace.replace(':', "'")}"</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Fixed Container - Actions */}
                <div className="absolute bottom-0 inset-x-0 pb-12 pt-6 px-6 bg-[#1a1b1e]/95 backdrop-blur-2xl rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-20">
                    <div className="flex items-center justify-between w-full max-w-[340px] mx-auto mt-1 relative">
                        
                        {/* Return/Stop Action */}
                        <button onClick={stopRun} className="flex flex-col items-center gap-2 group cursor-pointer z-10 w-[72px]">
                            <div className="w-[60px] h-[60px] rounded-full bg-[#2a2b2f] border border-white/5 flex items-center justify-center relative shadow-lg group-hover:scale-105 transition-transform">
                                {workoutType === 'run' ? <Flame size={26} className="text-[#a8ff78]" /> : <Navigation size={26} className="text-[#00e5ff]"/>}
                                <div className="absolute top-0 right-0 w-[18px] h-[18px] bg-[#34c759] rounded-full flex items-center justify-center border-2 border-[#1a1b1e]">
                                    <CheckCircle2 size={12} className="text-black" />
                                </div>
                            </div>
                            <span className="text-[13px] font-bold text-slate-300 tracking-wide mt-1">Run</span>
                        </button>

                        {/* Play/Pause Central Button */}
                        <button onClick={togglePause} className="flex flex-col items-center gap-2 transform -translate-y-[28px] group cursor-pointer z-20 relative">
                            <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-tr from-[#e64a19] to-[#ff6e40] shadow-[0_12px_30px_rgba(255,81,0,0.4)] flex items-center justify-center group-active:scale-90 transition-all outline-none border-[6px] border-[#1a1b1e]">
                                {isPaused ? <Play size={38} className="text-white fill-white ml-2 drop-shadow-md" /> : <Pause size={38} className="text-white fill-white drop-shadow-md" />}
                            </div>
                            <span className="text-[14px] font-bold font-sans text-orange-500 uppercase tracking-widest absolute -bottom-8">{isPaused ? 'Resume' : 'Start'}</span>
                        </button>

                        {/* Add Route Action */}
                        <button onClick={() => {}} className="flex flex-col items-center gap-2 group cursor-pointer z-10 w-[72px]">
                            <div className="w-[60px] h-[60px] rounded-full bg-[#2a2b2f] border border-white/5 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                            </div>
                            <span className="text-[13px] font-bold text-slate-300 tracking-wide mt-1">Add Route</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };`;

const newFileContent = fileContent.replace(oldReturnStr, newReturnStr);

if (newFileContent === fileContent) {
    throw new Error('Replacement failed, strings identical or not found');
}

fs.writeFileSync('src/App.tsx', newFileContent, 'utf8');

console.log("Successfully replaced visual rendering structure.");
