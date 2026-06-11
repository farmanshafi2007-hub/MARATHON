import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{\/\* Stats Grid \*\/\}[\s\S]*?\{\/\* Bottom Fixed Container - Actions \*\/\}/m;

const newStats = `{/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 w-full mb-10 px-0.5">
                        {/* Pace */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={20} className="text-[#a8ff78]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Pace</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5">
                                <span className="text-3xl font-bold text-[#a8ff78] leading-none">{formatCurrentPace(currentSpeed).replace(':', "'")}</span>
                                <span className="text-xs text-slate-500 font-semibold mb-1">/km</span>
                            </div>
                        </div>
                        {/* Speed */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Flame size={20} className="text-[#ff9500]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Speed</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5">
                                <span className="text-3xl font-bold text-[#ff9500] leading-none">
                                    {(currentSpeed || 0).toFixed(1)}
                                </span>
                                <span className="text-xs text-slate-500 font-semibold mb-1">km/h</span>
                            </div>
                        </div>
                        {/* Duration */}
                        <div className="bg-[#141518]/80 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col shadow-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock size={20} className="text-[#0a84ff]" />
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-none">Duration</span>
                            </div>
                            <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-[20px] font-bold text-[#0a84ff] tracking-tight">{formatTime(elapsed)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Fixed Container - Actions */}`;

content = content.replace(regex, newStats);

fs.writeFileSync('src/App.tsx', content);
