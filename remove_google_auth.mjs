import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<>\s*<button \s*id="google-login-btn"[\s\S]*?id="onboarding-guest-btn"[\s\S]*?<\/button>\s*<\/>/m;

const replacement = `<>
    <button 
        id="onboarding-guest-btn"
        onClick={handleGuestLogin}
        disabled={isSigningIn}
        className="w-full py-4 bg-[#34c759] text-white rounded-2xl font-bold text-sm skeuo-btn uppercase tracking-wider hover:bg-emerald-500 duration-300 disabled:opacity-50 cursor-pointer"
    >
        {isSigningIn ? "Starting..." : "GET STARTED"}
    </button>
</>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/App.tsx', content);
