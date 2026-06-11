import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Move Onboarding Hooks out
content = content.replace(
    /const Onboarding = \(\) => \{\n\s*const \[step, setStep\] = useState\(0\);\n\s*const \[isSigningIn, setIsSigningIn\] = useState\(false\);\n\s*const \[authError, setAuthError\] = useState<string \| null>\(null\);\n\s*const \[showRedirectOption, setShowRedirectOption\] = useState\(false\);/,
    `const Onboarding = () => {`
);

// We need to inject them into App. Find the right spot.
const onboardingHooks = `    // Onboarding Hooks
    const [step, setStep] = useState(0);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showRedirectOption, setShowRedirectOption] = useState(false);
`;
content = content.replace(/const \[workoutType, setWorkoutType\] = useState\<'run' \| 'walk'\>\('run'\);/, `const [workoutType, setWorkoutType] = useState<'run' | 'walk'>('run');\n${onboardingHooks}`);

// 2. Move Home Hooks out
const homeHooksRegex = /const \[waterIntake, setWaterIntake\] = useState\(\(\) => \{[\s\S]*?\}\);\n\n\s*useEffect\(\(\) => \{\n\s*localStorage\.setItem\('daily_water_intake', waterIntake\.toString\(\)\);\n\s*\}, \[waterIntake\]\);/m;
const homeHooksMatch = content.match(homeHooksRegex);
if (homeHooksMatch) {
    content = content.replace(homeHooksMatch[0], '');
    content = content.replace(/const \[workoutType, setWorkoutType\] = useState\<'run' \| 'walk'\>\('run'\);/, `const [workoutType, setWorkoutType] = useState<'run' | 'walk'>('run');\n    // Home Hooks\n    ${homeHooksMatch[0]}`);
}

// 3. Move Run Hooks out
content = content.replace(/const Run = \(\) => \{ \n\s*const \[isFollowCamera, setIsFollowCamera\] = useState\(true\);/, `const Run = () => {`);
content = content.replace(/const \[workoutType, setWorkoutType\] = useState\<'run' \| 'walk'\>\('run'\);/, `const [workoutType, setWorkoutType] = useState<'run' | 'walk'>('run');\n    // Run Hooks\n    const [isFollowCamera, setIsFollowCamera] = useState(true);`);

// 4. Move MapPanner out entirely.
const mapPannerRegex = /\/\/ ACTIVE APP VIEW \(Running Counter screen\)\n\s*const MapPanner = \(\{ isFollowCamera, runnerPt \}: \{ isFollowCamera: boolean, runnerPt: \{ lat: number, lng: number \}\}\) => \{[\s\S]*?return null;\n\s*\};/m;
const mapPannerMatch = content.match(mapPannerRegex);
if(mapPannerMatch) {
    content = content.replace(mapPannerMatch[0], '// ACTIVE APP VIEW (Running Counter screen)');
    content = content.replace(/function App\(\{ apiKey \}: \{ apiKey: string \}\) \{/, `${mapPannerMatch[0]}\n\nfunction App({ apiKey }: { apiKey: string }) {`);
}

// 5. Move MiniMap out entirely.
const miniMapRegex = /\/\/ Beautiful Vector MiniMap Component\n\s*const MiniMap = \(\{ coordinates \}: \{ coordinates: \{ lat: number; lng: number \}\[\] \}\) => \{[\s\S]*?\}\);(?: |\n)*\};/m;
const miniMapMatch = content.match(miniMapRegex);
if (miniMapMatch) {
    content = content.replace(miniMapRegex, '');
    content = content.replace(/function App\(\{ apiKey \}: \{ apiKey: string \}\) \{/, `${miniMapMatch[0]}\n\nfunction App({ apiKey }: { apiKey: string }) {`);
}


// 6. Rewrite JSX in return block to use function calls
content = content.replace(/\{view === 'splash' && <Splash key="splash" \/>\}/g, "{view === 'splash' && Splash()}");
content = content.replace(/\{view === 'home' && <Home key="home" \/>\}/g, "{view === 'home' && Home()}");
content = content.replace(/\{view === 'plan' && <PlanView key="plan" \/>\}/g, "{view === 'plan' && PlanView()}");
content = content.replace(/\{view === 'run_tab' && <RunTab key="run_tab" \/>\}/g, "{view === 'run_tab' && RunTab()}");
content = content.replace(/\{view === 'progress' && <ProgressView key="progress" \/>\}/g, "{view === 'progress' && ProgressView()}");
content = content.replace(/\{view === 'more' && <MoreView key="more" \/>\}/g, "{view === 'more' && MoreView()}");
content = content.replace(/\{view === 'run' && <Run key="run" \/>\}/g, "{view === 'run' && Run()}");
content = content.replace(/\{view === 'profile' && <Profile key="profile" \/>\}/g, "{view === 'profile' && Profile()}");
content = content.replace(/\{view === 'privacy' && <Privacy key="privacy" \/>\}/g, "{view === 'privacy' && Privacy()}");
content = content.replace(/\{view === 'onboarding' && <Onboarding key="onboarding" \/>\}/g, "{view === 'onboarding' && Onboarding()}");

fs.writeFileSync('src/App.tsx', content);
console.log('React Optimization applied.');
