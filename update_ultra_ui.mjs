import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div id="active-workout-view"[\s\S]*?<\/div>\s*<\/div>\s*\)\s*;\s*}/m;

const ultraUI = `<div id="active-workout-view" className="absolute inset-0 z-[61] bg-[#000000] text-white flex flex-col justify-between w-full h-full pb-8 overflow-hidden">
                {/* Background Elite Effects */}
                <div className="absolute inset-0 pointer-events-none opacity-40">
                    <div className="absolute top-[10%] left-[-10%] w-96 h-96 bg-[#34c759] opacity-30 blur-[120px] rounded-full mix-blend-screen transition-opacity duration-1000 ${`isPaused ? 'opacity-10' : 'opacity-30'`}"></div>
                    <div className="absolute bottom-[20%] right-[-10%] w-[30rem] h-[30rem] bg-[#00a86b] opacity-20 blur-[130px] rounded-full mix-blend-screen"></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]"></div>
                </div>

                <div className="flex flex-col items-center pt-20 px-8 relative z-10 w-full flex-grow">
                    
                    {/* Status Pill */}
                    <div className={"mb-12 px-5 py-2 rounded-full border flex items-center gap-2 backdrop-blur-md transition-all duration-300 " + (isPaused ? 'bg-white/10 border-white/20' : 'bg-[#34c759]/20 border-[#34c759]/40')}>
                        {!isPaused && <div className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse shadow-[0_0_8px_#34c759]"></div>}
                        {isPaused && <div className="w-2 h-2 rounded-full bg-white/50"></div>}
                        <p className={"text-[10px] uppercase tracking-[0.25em] font-bold " + (isPaused ? 'text-white/70' : 'text-[#34c759]')}>
                            {isPaused ? 'PAUSED' : (gpsStatus === 'GPS READY' && !autoPaused ? 'RECORDING ELITE RUN' : (autoPaused ? 'AUTO-PAUSED' : gpsStatus))}
                        </p>
                    </div>
                    
                    {/* Main Distance Readout */}
                    <div className="text-center mb-12 w-full flex flex-col items-center">
                        <div className="text-[9.5rem] font-light tracking-tighter leading-none mb-1 text-white tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                            {displayDistance}
                        </div>
                        <p className="text-sm font-bold tracking-[0.3em] text-white/50 uppercase">
                            Kilometers
                        </p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-x-8 w-full max-w-[320px] mb-auto">
                        <div className="flex flex-col items-start border-l-2 border-[#34c759]/30 pl-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1">Time</p>
                            <h1 className="text-4xl font-light tracking-tight text-white tabular-nums">
                                {formatHugeTimer(elapsed)}
                            </h1>
                        </div>
                        <div className="flex flex-col items-start border-l-2 border-[#34c759]/30 pl-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1">Avg Pace</p>
                            <p className="text-4xl font-light tabular-nums text-white">{formatPace(elapsed, distance).replace(':', "'")}<span className="text-lg text-white/40 mb-1">"</span></p>
                        </div>
                    </div>
                </div>

                {/* Control Deck */}
                <div className="flex justify-center items-end gap-8 pb-12 z-10 h-32 relative">
                    {/* Inner shadow overlay for controls */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none -z-10"></div>
                    
                    {isPaused && (
                         <button 
                         onClick={stopRun} 
                         className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/50 flex flex-col items-center justify-center active:scale-90 transition-all opacity-100 hover:bg-red-500/30"
                     >
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="7" width="10" height="10" fill="#ff453a"></rect></svg>
                         <span className="text-[8px] font-black uppercase tracking-widest text-[#ff453a] mt-1">STOP</span>
                     </button>
                    )}
                    <button 
                        onClick={togglePause} 
                        className={"w-[5.5rem] h-[5.5rem] rounded-full flex flex-col items-center justify-center active:scale-95 transition-all outline-none duration-300 " + (isPaused ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "bg-[#34c759] text-white shadow-[0_0_40px_rgba(52,199,89,0.4)] hover:bg-[#2eb350]")}
                    >
                         {isPaused ? <Play size={32} className="fill-black stroke-black translate-x-1" /> : <Pause size={32} className="fill-white stroke-white" />}
                    </button>
                </div>
            </div>
        );
    }`;

content = content.replace(regex, ultraUI);

fs.writeFileSync('src/App.tsx', content);
