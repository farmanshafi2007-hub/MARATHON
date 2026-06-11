import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the Return/Stop Action in active-workout-view
const oldStopAuthRegex = /\{\/\* Return\/Stop Action \*\/\}[\s\S]*?<\/button>/m;

const newStopButton = `{/* Return/Stop Action */}
                        <button onClick={stopRun} className="flex flex-col items-center gap-2 group cursor-pointer z-10 w-[72px]">
                            <div className="w-[60px] h-[60px] rounded-full bg-[#2a2b2f] border border-white/5 flex items-center justify-center relative shadow-lg group-hover:scale-105 transition-transform">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="6" height="6"></rect><circle cx="12" cy="12" r="10"></circle></svg>
                            </div>
                            <span className="text-[13px] font-bold text-slate-300 tracking-wide mt-1">End</span>
                        </button>`;

content = content.replace(oldStopAuthRegex, newStopButton);

// Let's refine the Google Sign in Auth button as well to make it more premium.
const oldGoogleBtnRegex = /<button\s+id="google-login-btn"[\s\S]*?<\/button>/m;

const newGoogleBtn = `<button 
                                id="google-login-btn"
                                onClick={() => handleLogin(false)}
                                disabled={isSigningIn}
                                className="w-full py-4 bg-gradient-to-r from-neutral-800 to-black text-white hover:from-neutral-700 hover:to-neutral-900 rounded-2xl font-bold text-sm skeuo-btn flex items-center justify-center gap-3 border border-white/10 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-[1px] transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {isSigningIn ? (
                                    <>
                                        <Loader2 className="animate-spin text-white" size={18} />
                                        <span className="tracking-wide">Synchronizing Profile...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white p-1 rounded-full"><svg width="18" height="18" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg></div>
                                        <span className="font-sans ml-1 tracking-wide">Continue with Google</span>
                                    </>
                                )}
                            </button>`;

content = content.replace(oldGoogleBtnRegex, newGoogleBtn);

fs.writeFileSync('src/App.tsx', content);
