import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /{formatPace\(elapsed, distance\)\.replace\(':', "'"\)}<span className="text-lg text-white\/40 mb-1">"<\/span><\/p>\s*<\/div>\s*<\/div>/m;

const replacement = `{formatPace(elapsed, distance).replace(':', "'")}<span className="text-lg text-white/40 mb-1">"</span></p>
                        </div>
                        <div className="flex flex-col items-start border-l-2 border-[#34c759]/30 pl-5 col-span-2 mt-8">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1">Current Pace (30s Rolling)</p>
                            <p className="text-4xl font-light tabular-nums text-white">{formatCurrentPace(currentSpeed * 3.6).replace(':', "'")}<span className="text-lg text-white/40 mb-1">"</span></p>
                        </div>
                    </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);
