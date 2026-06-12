import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<>\s*<button \s*id="onboarding-guest-btn"[\s\S]*?<\/button>\s*<\/>/m;

const replacement = `<>
    <button 
        id="google-login-btn"
        onClick={() => handleLogin(false)}
        disabled={isSigningIn}
        className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-gray-200 duration-300 disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2 mb-3 shadow-[0_4px_14px_0_rgba(255,255,255,0.2)]"
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        {isSigningIn ? "Signing In..." : "SIGN IN WITH GOOGLE"}
    </button>
    
    {showRedirectOption && (
        <button 
            id="google-redirect-btn"
            onClick={() => handleLogin(true)}
            disabled={isSigningIn}
            className="w-full py-4 bg-transparent text-white border border-white/20 rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-white/10 duration-300 disabled:opacity-50 cursor-pointer mb-3"
        >
            OPEN IN NEW TAB / REDIRECT
        </button>
    )}

    <button 
        id="onboarding-guest-btn"
        onClick={handleGuestLogin}
        disabled={isSigningIn}
        className="w-full py-4 bg-[#34c759] text-white rounded-2xl font-bold text-sm skeuo-btn uppercase tracking-wider hover:bg-emerald-500 duration-300 disabled:opacity-50 cursor-pointer"
    >
        CONTINUE AS GUEST
    </button>
</>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
