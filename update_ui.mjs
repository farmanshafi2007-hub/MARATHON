import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div id="active-workout-view"[\s\S]*?<\/div>\s*<\/div>\s*\)\s*;\s*}/m;

const minimalUI = `<div id="active-workout-view" className="absolute inset-0 z-[61] bg-[#111111] text-white flex flex-col justify-between w-full h-full pb-8">
                <div className="flex flex-col items-center pt-24 px-6 relative z-10 w-full">
                    <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500 mb-8">
                        {gpsStatus === 'RECORDING' && !autoPaused ? 'TRACKING ACTIVE' : (autoPaused ? 'AUTO-PAUSED' : gpsStatus)}
                    </p>
                    
                    <div className="text-center mb-16 w-full flex flex-col items-center">
                        <div className="text-[8rem] font-light tracking-tighter leading-none mb-2">
                            {displayDistance}
                        </div>
                        <p className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
                            Kilometers
                        </p>
                    </div>

                    <h1 className="text-6xl font-light tracking-tighter text-white tabular-nums mb-16">
                        {formatHugeTimer(elapsed)}
                    </h1>

                    <div className="grid grid-cols-2 gap-x-12 w-full max-w-sm">
                        <div className="text-left border-l border-white/20 pl-5">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Pace</p>
                            <p className="text-3xl font-light tabular-nums">{formatCurrentPace(currentSpeed).replace(':', "'")}</p>
                        </div>
                        <div className="text-left border-l border-white/20 pl-5">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Avg</p>
                            <p className="text-3xl font-light tabular-nums">{formatPace(elapsed, distance).replace(':', "'")}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center items-center gap-6 pb-12 z-10 space-x-4">
                    {isPaused && (
                         <button 
                         onClick={stopRun} 
                         className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center active:scale-90 transition-all opacity-80 hover:opacity-100"
                     >
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="7" width="10" height="10" fill="white"></rect></svg>
                     </button>
                    )}
                    <button 
                        onClick={togglePause} 
                        className="w-24 h-24 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 transition-all outline-none"
                    >
                         {isPaused ? <Play size={36} className="fill-black translate-x-1" /> : <Pause size={36} className="fill-black" />}
                    </button>
                </div>
            </div>
        );
    }`;

content = content.replace(regex, minimalUI);

fs.writeFileSync('src/App.tsx', content);
