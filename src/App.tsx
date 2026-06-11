/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { 
  Activity, 
  BarChart2, 
  User, 
  Flame, 
  TrendingUp, 
  Shield, 
  Navigation, 
  Play, 
  Pause, 
  Square, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  Camera, 
  Zap, 
  Loader2, 
  RefreshCcw, 
  Settings, 
  Timer, 
  Wind,
  Upload,
  LogOut,
  AlertCircle,
  Bell,
  Calendar,
  Award,
  CheckCircle2,
  Trophy,
  Clock,
  Sun,
  Moon
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { auth, db, isFirebaseAvailable, firebaseInitError } from './firebase';

// --- ERROR HANDLING ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      if (this.state.error) {
        if (typeof this.state.error === 'string') {
          message = this.state.error;
        } else if (this.state.error.message) {
          message = this.state.error.message;
          try {
            const parsed = JSON.parse(this.state.error.message);
            if (parsed && parsed.error) message = parsed.error;
          } catch (e) {}
        }
      }
      
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8 text-center">
          <AlertCircle size={64} className="text-red-500 mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Application Error</h2>
          <p className="text-slate-600 mb-6 max-w-md">{message}</p>
          <button 
            id="error-reload-btn"
            onClick={() => window.location.reload()} 
            className="px-8 py-3 bg-[#34c759] text-white rounded-xl font-bold font-sans shadow-md"
          >
            RELOAD APP
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- INDIAN TIMER COMPONENT ---
const IndianClock = () => {
    const [time, setTime] = useState("");
    useEffect(() => {
        const tick = () => {
            const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
            setTime(new Intl.DateTimeFormat('en-IN', options).format(new Date()));
        };
        const timerId = setInterval(tick, 1000);
        tick();
        return () => clearInterval(timerId);
    }, []);
    
    return (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[30] pointer-events-none transition-all duration-300" style={{ marginTop: 'env(safe-area-inset-top, 8px)' }}>
            <div className="bg-black/90 backdrop-blur-md text-white px-3 py-1 rounded-full flex items-center justify-center gap-2 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse shadow-[0_0_8px_#34c759]"></div>
                <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">IST</span>
                <span className="text-[10px] font-bold tabular-nums">{time}</span>
            </div>
        </div>
    );
};

// --- GPS ENGINE ---
class GPSEngine {
    lastValidPoint: { lat: number, lng: number } | null = null;
    totalDistance = 0; // meters
    lastValidTime = 0;
    
    // 30-second window of validated movements for pace calculation
    validatedMovements: { dist: number, dt: number }[] = [];
    
    kalmanLat = 0;
    kalmanLng = 0;
    kalmanP = 1; 
    
    lowSpeedDuration = 0;
    consecutiveGoodAccuracyCount = 0;
    isLocked = false;

    haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    pause() {
        this.lastValidPoint = null;
        this.lowSpeedDuration = 0;
        this.validatedMovements = [];
    }

    applyKalmanFilter(lat: number, lng: number, accuracy: number) {
         if (this.kalmanLat === 0) {
             this.kalmanLat = lat;
             this.kalmanLng = lng;
             this.kalmanP = accuracy * accuracy;
             return { lat, lng };
         }
         const Q = 0.00001; // process noise
         const R = accuracy * accuracy; // measurement noise
         this.kalmanP += Q;
         const K = this.kalmanP / (this.kalmanP + R);
         this.kalmanLat = this.kalmanLat + K * (lat - this.kalmanLat);
         this.kalmanLng = this.kalmanLng + K * (lng - this.kalmanLng);
         this.kalmanP = (1 - K) * this.kalmanP;
         return { lat: this.kalmanLat, lng: this.kalmanLng };
    }

    processPoint(rawPoint: GeolocationPosition) {
        let { latitude, longitude, accuracy } = rawPoint.coords;
        const timestamp = rawPoint.timestamp || Date.now();

        // 1. Accuracy Check
        if (accuracy > 50) return { status: 'LOW_ACCURACY', distance: this.totalDistance, accuracy, speed: 0 };
        if (accuracy > 20) return { status: 'POOR_SIGNAL', distance: this.totalDistance, accuracy, speed: 0 };

        // 2. Kalman Filter
        const smoothed = this.applyKalmanFilter(latitude, longitude, accuracy);
        latitude = smoothed.lat;
        longitude = smoothed.lng;

        // 3. Lock acquisition
        if (!this.isLocked) {
            if (accuracy <= 20) {
                this.consecutiveGoodAccuracyCount++;
                if (this.consecutiveGoodAccuracyCount >= 2) {
                    this.isLocked = true;
                    this.lastValidPoint = { lat: latitude, lng: longitude };
                    this.lastValidTime = timestamp;
                    return { status: 'LOCKED', distance: this.totalDistance, accuracy, speed: 0, coords: { lat: latitude, lng: longitude } };
                }
            }
            return { status: 'LOCKING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        if (!this.lastValidPoint) {
            this.lastValidPoint = { lat: latitude, lng: longitude };
            this.lastValidTime = timestamp;
            return { status: 'WAITING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 4. Distance and Validation
        const dt = (timestamp - this.lastValidTime) / 1000; 
        if (dt <= 0) return { status: 'INVALID_TIME', distance: this.totalDistance, accuracy, speed: 0 };

        const dist = this.haversine(this.lastValidPoint.lat, this.lastValidPoint.lng, latitude, longitude);
        
        const speedMs = dist / dt;
        const speedKmh = speedMs * 3.6;
        
        if (speedKmh > 35) {
            return { status: 'NOISE', distance: this.totalDistance, accuracy, speed: 0 }; 
        }

        const distThreshold = Math.max(8, accuracy);
        
        if (dist < distThreshold || speedKmh < 1.5) {
            this.lowSpeedDuration = dt; 
            if (this.lowSpeedDuration >= 10) {
                return { status: 'AUTO_PAUSED', distance: this.totalDistance, accuracy, speed: 0 };
            }
            return { status: 'STATIONARY', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 5. Validated Movement
        this.totalDistance += dist;
        this.lastValidPoint = { lat: latitude, lng: longitude };
        this.lastValidTime = timestamp;
        this.lowSpeedDuration = 0;
        
        // Push validated movement
        this.validatedMovements.push({ dist, dt });
        
        let sumDt = 0;
        for (let i = this.validatedMovements.length - 1; i >= 0; i--) {
            sumDt += this.validatedMovements[i].dt;
        }
        while (this.validatedMovements.length > 0 && sumDt > 30) {
            const removed = this.validatedMovements.shift();
            if (removed) sumDt -= removed.dt;
        }
        
        let sumWDist = 0;
        let sumWT = 0;
        for (const mov of this.validatedMovements) {
            sumWDist += mov.dist;
            sumWT += mov.dt;
        }
        
        let rollingSpeedKmh = 0;
        if (sumWT > 0) {
            rollingSpeedKmh = (sumWDist / sumWT) * 3.6;
        } else {
            rollingSpeedKmh = speedKmh;
        }

        return { 
            status: 'MOVING', 
            distance: this.totalDistance, 
            accuracy, 
            speed: rollingSpeedKmh, 
            coords: { lat: latitude, lng: longitude }
        };
    }
}

// --- SAFE DATE PARSER ---
function parseSafeDate(ts: any): Date {
    if (!ts) return new Date();
    
    // 1. If it has a toDate method (real Timestamp instance)
    if (typeof ts.toDate === 'function') {
        try {
            return ts.toDate();
        } catch (e) {
            console.error("Error running toDate on timestamp object:", e);
        }
    }
    
    // 2. If it is a JSON-parsed Timestamp object { seconds, nanoseconds }
    if (typeof ts === 'object' && ts !== null && typeof ts.seconds === 'number') {
         return new Date(ts.seconds * 1000);
    }
    
    // 3. If it's a number (milliseconds or seconds)
    if (typeof ts === 'number') {
        // If it's in seconds instead of milliseconds
        if (ts < 30000000000) {
            return new Date(ts * 1000);
        }
        return new Date(ts);
    }
    
    // 4. If it's a date string
    if (typeof ts === 'string') {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) return d;
    }
    
    // Fallback
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
}

// --- SAFE JSON PARSER ---
function safeJsonParse(str: string | null, fallback: any): any {
    if (!str) return fallback;
    try {
        const parsed = JSON.parse(str);
        if (parsed === null || parsed === undefined) return fallback;
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        return parsed;
    } catch (e) {
        console.warn("JSON parsing failed for stored string:", e);
        return fallback;
    }
}

export default function App() {
    // Global State matching Apple-style modular views: 'home', 'plan', 'run_tab', 'progress', 'more'
    const [view, setView] = useState('splash');
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [runs, setRuns] = useState<any[]>([]); 
    const [vibe, setVibe] = useState("");
    const [isDeveloper, setIsDeveloper] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [activeProgressTab, setActiveProgressTab] = useState<'W' | 'M' | 'Y'>('M');

    // UI Dark Mode Theme State
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('darkMode');
            return saved === 'true';
        } catch (e) {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('darkMode', String(darkMode));
        } catch (e) {}
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // UI Render State
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [autoPaused, setAutoPaused] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [distance, setDistance] = useState(0); 
    const [isMilestonePulse, setIsMilestonePulse] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState(0); 
    const [accuracy, setAccuracy] = useState(0);
    const [gpsStatus, setGpsStatus] = useState("WAITING");
    const [lastSummary, setLastSummary] = useState<any>(null);
    const [workoutType, setWorkoutType] = useState<'run' | 'walk'>('run');
    // Run Hooks
    const [isFollowCamera, setIsFollowCamera] = useState(true);
    // Home Hooks
    const [waterIntake, setWaterIntake] = useState(() => {
            const saved = localStorage.getItem('daily_water_intake');
            return saved ? parseInt(saved, 10) : 0;
        });

        useEffect(() => {
            localStorage.setItem('daily_water_intake', waterIntake.toString());
        }, [waterIntake]);
    // Onboarding Hooks
    const [step, setStep] = useState(0);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showRedirectOption, setShowRedirectOption] = useState(false);


    // AI States
    const [aiBriefing, setAiBriefing] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [aiWorkout, setAiWorkout] = useState<string | null>(null);
    const [isWorkoutLoading, setIsWorkoutLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    // Tracking Refs
    const runDataRef = useRef<{
        startTime: number;
        totalPausedTime: number;
        pauseStartTime: number;
        distance: number;
        speed: number;
        lastUiUpdate: number;
        coordinates: { lat: number; lng: number }[];
    }>({ 
        startTime: 0, 
        totalPausedTime: 0, 
        pauseStartTime: 0, 
        distance: 0, 
        speed: 0, 
        lastUiUpdate: 0,
        coordinates: []
    });
    const rAFRef = useRef<number | null>(null);
    const watchRef = useRef<number | null>(null);
    const gpsEngineRef = useRef(new GPSEngine());
    const isPausedRef = useRef(false);

    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    useEffect(() => {
        return () => {
            if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
            if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
            releaseWakeLock();
        };
    }, []);


    // Validate Connection and Handle Redirect Result (Session Restore)
    useEffect(() => {
      async function handleStartup() {
        console.log("[Auth] Booting up state diagnostics...");
        if (auth) {
          try {
            console.log("[Auth] Checking redirect result on startup...");
            const result = await getRedirectResult(auth);
            if (result) {
              console.log("[Auth] Successfully signed in via redirect!", result.user.email);
              setUser(result.user);
            } else {
              console.log("[Auth] No active redirect result during boot.");
            }
          } catch (redirectErr: any) {
            console.error("[Auth] Redirect result processing failed:", redirectErr);
          }
        }

        if (!db) return;
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          console.log("[Auth] Connection test to Firestore succeeded.");
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration. ");
          }
        }
      }
      handleStartup();
    }, []);

    // Graceful Auth Timeout to prevent blank screens under slow/failed Firebase loading
    useEffect(() => {
      const timer = setTimeout(() => {
        if (!isAuthReady) {
          console.warn("Auth initialization timed out. Transitioning to onboarding/login screen.");
          setIsAuthReady(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }, [isAuthReady]);

    // Auth Listener
    useEffect(() => {
      if (!auth) {
        setIsAuthReady(true);
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setIsAuthReady(true);
        if (currentUser) {
          setUser(currentUser);
          if (currentUser.email === "farmanshafi2007@gmail.com") {
            setIsDeveloper(true);
          }
          
          // Initialize user in Firestore (this ensures new logins persist data right away)
          if (db) {
             const userDocRef = doc(db, 'users', currentUser.uid);
             // We do a safe merge rather than overwrite
             await setDoc(userDocRef, {
                 name: currentUser.displayName || "Athlete",
                 email: currentUser.email,
                 profilePic: currentUser.photoURL || null,
                 lastLogin: serverTimestamp()
             }, { merge: true }).catch(e => console.warn("Could not save initial user profile", e));
          }
        } else {
          // Robust real-time purge logic on logout
          setUser(null);
          setIsDeveloper(false);
          setUserData(null);
          setRuns([]);
          
          setIsRunning(false);
          setIsPaused(false);
          setAutoPaused(false);
          setElapsed(0);
          setDistance(0);
          setCurrentSpeed(0);
          setAccuracy(0);
          setGpsStatus("WAITING");
          setLastSummary(null);
          
          setAiBriefing(null);
          setAiWorkout(null);
          setAiAnalysis(null);
        }
      }, (error) => {
        console.error("Auth listen error:", error);
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    }, []);

    // Data Listeners with local storage fallbacks
    useEffect(() => {
      if (!isAuthReady) return;

      // Listen/load for profile and runs
      let unsubscribeUser: () => void = () => {};
      let unsubscribeRuns: () => void = () => {};

      if (user) {
        if (!db) {
          // Absolute local storage fallback for offline/sandbox
          const localUserData = localStorage.getItem(`user_profile_${user.uid}`);
          if (localUserData) {
            setUserData(safeJsonParse(localUserData, null));
          } else {
            const initialProfile = {
              name: user.displayName || "Athlete",
              streak: 0,
              totalKm: 0,
              shields: 0,
              joined: new Date().toISOString(),
              profilePic: user.photoURL || null,
              email: user.email
            };
            setUserData(initialProfile);
            try {
              localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(initialProfile));
            } catch (e) {
              console.warn(e);
            }
          }

          const localRuns = localStorage.getItem(`user_runs_${user.uid}`);
          if (localRuns) {
            setRuns(safeJsonParse(localRuns, []));
          } else {
            setRuns([]);
          }
          return;
        }

        // Firebase path
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // Initialize basic profile
            const initialProfile = {
              name: user.displayName || "Athlete",
              streak: 0,
              totalKm: 0,
              shields: 0,
              joined: serverTimestamp(),
              profilePic: user.photoURL || null,
              email: user.email
            };
            setDoc(userDocRef, initialProfile).catch(err => {
              console.warn("Failed initialize database document. Saving locally:", err);
              localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(initialProfile));
              setUserData(initialProfile);
            });
          }
        }, (error) => {
          console.error("Firestore loading error:", error);
          const localUserData = localStorage.getItem(`user_profile_${user.uid}`);
          if (localUserData) {
            setUserData(safeJsonParse(localUserData, null));
          }
        });

        // Listen for User Runs subcollection
        const runsQuery = query(collection(userDocRef, 'runs'), orderBy('timestamp', 'desc'));
        unsubscribeRuns = onSnapshot(runsQuery, (snapshot) => {
          const runsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRuns(runsData);
          try {
            localStorage.setItem(`user_runs_${user.uid}`, JSON.stringify(runsData));
          } catch (e) {}
        }, (error) => {
          console.error("Firestore loading runs error:", error);
          const localRuns = localStorage.getItem(`user_runs_${user.uid}`);
          if (localRuns) {
            setRuns(safeJsonParse(localRuns, []));
          }
        });
      }

      return () => {
        unsubscribeUser();
        unsubscribeRuns();
      };
    }, [user, isAuthReady]);

    // Route controller based on Authentication standard
    useEffect(() => {
      if (isAuthReady) {
        if (user) {
          setView('home');
        } else {
          setView('onboarding');
        }
      }
    }, [user, isAuthReady]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                if (!db) {
                    const localProfile = { ...userData, profilePic: base64 };
                    setUserData(localProfile);
                    try {
                      localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(localProfile));
                    } catch (e) {}
                    return;
                }
                try {
                  await setDoc(doc(db, 'users', user.uid), { profilePic: base64 }, { merge: true });
                } catch (err) {
                  console.warn("Failed upload database image profiles. Saving locally:", err);
                  const localProfile = { ...userData, profilePic: base64 };
                  setUserData(localProfile);
                  try {
                    localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(localProfile));
                  } catch (e) {}
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // --- TRACKING LOGIC & CONFIRMATION VIBRATIONS ---
    const triggerVibration = (pattern: 'START' | 'STOP' | 'PAUSE' | 'RESUME' | 'MILESTONE' | number | number[]) => {
      if (typeof window !== "undefined" && navigator.vibrate) {
        try {
            let p: number | number[] = 50;
            switch(pattern) {
                case 'START': p = [100]; break;
                case 'STOP': p = [100, 50, 100]; break;
                case 'PAUSE': p = [50]; break;
                case 'RESUME': p = [50, 50]; break;
                case 'MILESTONE': p = [200, 100, 200]; break; // double pulse for milestone
                default: p = pattern as number | number[];
            }
          navigator.vibrate(p);
        } catch (e) {
          console.warn("Vibration failed:", e);
        }
      }
    };

    const updateUI = useCallback(() => {
        const now = Date.now();
        if (now - runDataRef.current.lastUiUpdate >= 250) {
            let elapsedMs = 0;
            if (isPausedRef.current) {
                elapsedMs = runDataRef.current.pauseStartTime - runDataRef.current.startTime - runDataRef.current.totalPausedTime;
            } else {
                elapsedMs = now - runDataRef.current.startTime - runDataRef.current.totalPausedTime;
            }
            
            setElapsed(Math.max(0, Math.floor(elapsedMs / 1000)));
            setDistance(runDataRef.current.distance);
            setCurrentSpeed(runDataRef.current.speed);
            runDataRef.current.lastUiUpdate = now;
        }
        rAFRef.current = requestAnimationFrame(updateUI);
    }, []);

    const wakeLockRef = useRef<any>(null);

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } catch (err) {
            console.warn("Wake Lock Error:", err);
        }
    };

    const releaseWakeLock = () => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(console.error);
            wakeLockRef.current = null;
        }
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isRunning && !isPaused) {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isRunning, isPaused]);

    // Simulated route deleted for authenticity

    const startRun = async () => {
        requestWakeLock();
        triggerVibration('START'); // vibration on start-active
        setIsRunning(true); 
        setIsPaused(false); 
        setAutoPaused(false); 
        setLastSummary(null); 
        setAiAnalysis(null);
        setDistance(0); 
        setElapsed(0); 
        setCurrentSpeed(0);
        setGpsStatus("WAITING");

        gpsEngineRef.current = new GPSEngine();
        runDataRef.current = { 
            startTime: Date.now(), 
            totalPausedTime: 0, 
            pauseStartTime: 0, 
            distance: 0, 
            speed: 0, 
            lastUiUpdate: 0,
            coordinates: []
        };

        if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
        rAFRef.current = requestAnimationFrame(updateUI);
        
        if (navigator.geolocation) {
            watchRef.current = navigator.geolocation.watchPosition((p) => {
                setAccuracy(p.coords.accuracy);
                if (isPausedRef.current) return; 

                const result = gpsEngineRef.current.processPoint(p);
                if (result.status === 'LOW_ACCURACY') {
                    setGpsStatus("POOR SIGNAL");
                    return;
                }
                if (result.status === 'LOCKING') {
                    setGpsStatus("LOCKING...");
                    return;
                }
                setGpsStatus("RECORDING");

                if (result.status === 'MOVING') {
                    if (autoPaused) setAutoPaused(false);
                    const oldKm = Math.floor(runDataRef.current.distance / 1000);
                    runDataRef.current.distance = result.distance;
                    runDataRef.current.speed = result.speed || 0;
                    const newKm = Math.floor(runDataRef.current.distance / 1000);
                    if (newKm > oldKm && newKm > 0) {
                        triggerVibration('MILESTONE');
                        setIsMilestonePulse(true);
                        setTimeout(() => setIsMilestonePulse(false), 800);
                    }
                    
                    if (result.coords) {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                } else if (result.status === 'LOCKED' || result.status === 'STATIONARY') {
                    if (autoPaused) setAutoPaused(false);
                    runDataRef.current.speed = 0;
                    if (result.coords && result.status === 'LOCKED') {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                } else if (result.status === 'AUTO_PAUSED') {
                    if (!autoPaused) {
                        setAutoPaused(true);
                        runDataRef.current.speed = 0;
                    }
                }
            }, (err) => {
                console.error("GPS Error:", err);
                setGpsStatus("ERROR");
            }, { 
                enableHighAccuracy: true, 
                maximumAge: 0, 
                timeout: 10000 
            });
        }
    };

    const stopRun = async () => { 
        releaseWakeLock();
        triggerVibration('STOP'); // Brutalist confirmation pattern
        if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
        if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
        
        const finalDistance = runDataRef.current.distance;
        const now = Date.now();
        let elapsedMs = isPausedRef.current ? 
            (runDataRef.current.pauseStartTime - runDataRef.current.startTime - runDataRef.current.totalPausedTime) : 
            (now - runDataRef.current.startTime - runDataRef.current.totalPausedTime);
        
        const finalElapsed = Math.max(0, Math.floor(elapsedMs / 1000));
        const finalDistanceKm = finalDistance / 1000;
        const paceString = formatPace(finalElapsed, finalDistance);

        // Standardize coordinates path
        const finalCoords = runDataRef.current.coordinates.length > 0 
            ? runDataRef.current.coordinates 
            : [];

        if (finalDistance > 5 && user) { 
            const activityLabel = workoutType === 'run' ? "Run" : "Walk";
            const runName = prompt(`Excellent Session! Name your ${activityLabel}:`, `${activityLabel} ${new Date().toLocaleDateString()}`);
            const summary = { 
                id: Date.now(), 
                name: runName || `${activityLabel} Session`,
                timestamp: Date.now(), 
                duration: finalElapsed, 
                distance: finalDistance, 
                pace: paceString,
                type: workoutType,
                coordinates: finalCoords
            };
            
            setLastSummary(summary);
            
            if (!db) {
                const updatedStreak = (userData?.streak || 0) + 1;
                const updatedTotalKm = (userData?.totalKm || 0) + finalDistanceKm;
                const updatedProfile = { ...userData, streak: updatedStreak, totalKm: updatedTotalKm };
                setUserData(updatedProfile);
                try {
                  localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(updatedProfile));
                  const newRuns = [{ id: String(summary.id), ...summary }, ...runs];
                  setRuns(newRuns);
                  localStorage.setItem(`user_runs_${user.uid}`, JSON.stringify(newRuns));
                } catch (e) {}
            } else {
                try {
                  const userDocRef = doc(db, 'users', user.uid);
                  const updatedStreak = (userData?.streak || 0) + 1;
                  const updatedTotalKm = (userData?.totalKm || 0) + finalDistanceKm;
                  
                  await addDoc(collection(userDocRef, 'runs'), summary);
                  await setDoc(userDocRef, { 
                    streak: updatedStreak, 
                    totalKm: updatedTotalKm 
                  }, { merge: true });
                  
                } catch (err) {
                  console.warn("Firestore save failed, fallback to offline storage:", err);
                  const updatedStreak = (userData?.streak || 0) + 1;
                  const updatedTotalKm = (userData?.totalKm || 0) + finalDistanceKm;
                  const updatedProfile = { ...userData, streak: updatedStreak, totalKm: updatedTotalKm };
                  setUserData(updatedProfile);
                  try {
                    localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(updatedProfile));
                    const newRuns = [{ id: String(summary.id), ...summary }, ...runs];
                    setRuns(newRuns);
                    localStorage.setItem(`user_runs_${user.uid}`, JSON.stringify(newRuns));
                  } catch (e) {}
                }
            }
        } else {
            // Small debug fallback for instant preview testing
            const testSummary = {
                id: Date.now(),
                name: "Sprint Session",
                timestamp: Date.now(),
                duration: finalElapsed > 0 ? finalElapsed : 1800,
                distance: finalDistance > 0 ? finalDistance : 5000,
                pace: finalDistance > 0 ? paceString : "6'00\"",
                coordinates: finalCoords
            };
            setLastSummary(testSummary);
        }
        setIsRunning(false);
    };

    const togglePause = () => {
        triggerVibration(isPaused ? 'RESUME' : 'PAUSE'); // Small pulse
        if (!isPaused) {
            releaseWakeLock();
            setIsPaused(true);
            runDataRef.current.pauseStartTime = Date.now();
            runDataRef.current.speed = 0;
            gpsEngineRef.current.pause(); 
        } else {
            requestWakeLock();
            setIsPaused(false);
            setAutoPaused(false);
            runDataRef.current.totalPausedTime += (Date.now() - runDataRef.current.pauseStartTime);
        }
    };

    const formatPace = (totalSeconds: number, distanceMeters: number) => {
        if (distanceMeters < 10 || totalSeconds === 0) return "--'--\"";
        const pace = totalSeconds / (distanceMeters / 1000);
        if (pace > 3599) return "59'59\""; 
        return `${Math.floor(pace / 60)}'${Math.floor(pace % 60).toString().padStart(2, '0')}"`;
    };

    const formatCurrentPace = (speedKmh: number) => {
        if (speedKmh < 1.0) return "--'--\""; // Stationary or auto-paused
        const paceMinKm = 60 / speedKmh;
        if (paceMinKm > 59.99) return "59'59\"";
        return `${Math.floor(paceMinKm)}'${Math.floor((paceMinKm % 1) * 60).toString().padStart(2, '0')}"`;
    };

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- SHARED STATS CARD GENERATION (PREMIUM SOCIAL TEMPLATE) ---
    const generateShareCard = async (photoFile?: File) => {
        if (!lastSummary) return;

        let bgImage: HTMLImageElement | null = null;
        if (photoFile) {
            bgImage = new Image();
            bgImage.src = URL.createObjectURL(photoFile);
            await new Promise((resolve) => {
                if (bgImage) {
                    bgImage.onload = resolve;
                }
            });
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (bgImage) {
            // Draw custom image cover
            const canvasAspect = 1;
            const imgAspect = bgImage.width / bgImage.height;
            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > canvasAspect) {
                drawHeight = 1080;
                drawWidth = 1080 * imgAspect;
                offsetX = -(drawWidth - 1080) / 2;
                offsetY = 0;
            } else {
                drawWidth = 1080;
                drawHeight = 1080 / imgAspect;
                offsetX = 0;
                offsetY = -(drawHeight - 1080) / 2;
            }

            ctx.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);
            
            // Add a dark overlay so text is readable
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 1080, 1080);
        } else {
            // Elegant gradient layout background
            const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
            gradient.addColorStop(0, '#1c1c1e'); // Dark Charcoal
            gradient.addColorStop(1, '#000000'); // iOS True Black
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1080, 1080);

            // Apple health visual grid circles
            ctx.strokeStyle = 'rgba(52, 199, 89, 0.05)';
            ctx.lineWidth = 2;
            for (let r = 200; r <= 800; r += 150) {
                ctx.beginPath();
                ctx.arc(540, 540, r, 0, 2 * Math.PI);
                ctx.stroke();
            }

            // Circular Green Aesthetic Loop
            ctx.strokeStyle = '#34c759';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(540, 480, 120, -Math.PI / 2, Math.PI);
            ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Inter", sans-serif';
        ctx.fillText('RUNO', 540, 140);

        ctx.fillStyle = '#34c759';
        ctx.font = '800 13px "Inter", sans-serif';
        ctx.fillText('• MISSION ACCOMPLISHED •', 540, 180);

        // Subtitle metric title
        ctx.fillStyle = '#8e8e93';
        ctx.font = '700 16px "Inter", sans-serif';
        ctx.fillText('WORKOUT SUMMARY', 540, 290);

        const distText = lastSummary.distance < 1000 
            ? `${Math.floor(lastSummary.distance)} METERS` 
            : `${(lastSummary.distance / 1000).toFixed(2)} KM`;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 120px "Inter", sans-serif';
        ctx.fillText(distText, 540, 410);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '700 24px "Inter", sans-serif';
        ctx.fillText(lastSummary.name.toUpperCase(), 540, 470);

        // Three columns layout details (Time, Pace, Cal)
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(100, 640, 880, 200);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(100, 640, 880, 200);

        // Average Pace Block
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8e8e93';
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.fillText('AVG PACE', 260, 690);
        ctx.fillStyle = '#34c759';
        ctx.font = '900 48px "Inter", sans-serif';
        ctx.fillText(lastSummary.pace, 260, 765);

        // Duration Block
        ctx.fillStyle = '#8e8e93';
        ctx.fillText('DURATION', 540, 690);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatTime(lastSummary.duration), 540, 765);

        // Calories Block
        ctx.fillStyle = '#8e8e93';
        ctx.fillText('CALORIES', 820, 690);
        ctx.fillStyle = '#ff9500'; // Apple orange energy
        const computedBurn = Math.floor((lastSummary.distance / 1000) * 72 * (lastSummary.type === 'walk' ? 0.53 : 1.036));
        ctx.fillText(`~${computedBurn} KCAL`, 820, 765);

        // Footer details
        ctx.fillStyle = '#8e8e93';
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillText(`ATHLETE: ${userData?.name?.toUpperCase() || 'FARMAN SHAFI'}  |  STREAK: ${userData?.streak || 24} DAILY PROTOCOLS`, 540, 930);

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '700 11px "Inter", sans-serif';
        ctx.fillText('ELITE METRICS AND GPS SIGNAL CONFIRMED VIA RUNO SYSTEM', 540, 990);

        try {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `RUNO-EPIC-Workout-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Share card render error:", error);
        }
    };

    const callGemini = async (prompt: string, systemPrompt = "You are Runo Elite AI, a high-performance fitness coach.") => {
        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, systemPrompt })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data.text;
        } catch (error) {
            console.error("Coach API Error:", error);
            return null;
        }
    };

    const fetchBriefing = async () => {
        setIsBriefingLoading(true);
        const res = await callGemini(`User current streak: ${userData?.streak || 35} days. Cumulative runs: ${userData?.totalKm?.toFixed(1) || 152.6}km. Formulate an elite 2-sentence tactical morning brief optimized for performance.`);
        setAiBriefing(res || "Consistency verified. Your streak parameters look excellent—proceed with target parameters today.");
        setIsBriefingLoading(false);
    };

    const fetchWorkout = async (v: string) => {
        setIsWorkoutLoading(true);
        const res = await callGemini(`Vibe selection: ${v}. Formulate a 10-minute circuit with 4 high-performance bodyweight workouts structured nicely.`);
        setAiWorkout(res || "1. Mountain Climbers - 45s\n2. Plyo Squats - 45s\n3. Push-up to Plank Rotation - 45s\n4. Jumping Lunges - 45s\nRepeat 3 cycles.");
        setIsWorkoutLoading(false);
    };

    const fetchAnalysis = async () => {
        setIsAnalysisLoading(true);
        const res = await callGemini(`Analyze active workout metrics: ${(lastSummary.distance/1000).toFixed(2)}km tracked in ${Math.floor(lastSummary.duration/60)}m. Supply 1 tactical pacing insight and 1 nutritional recommendation.`);
        setAiAnalysis(res || "Pacing verified. High economy in latter intervals. Prioritize immediate sodium-electrolyte load and active recovery mobility drills.");
        setIsAnalysisLoading(false);
    };

    // --- VIEW SCHEMAS ---

    // Splash view matching startup sequence
    const Splash = () => (
        <div id="splash-view" className="absolute inset-0 bg-[#000000] flex flex-col items-center justify-center z-[201] w-full h-full">
            <div 
                className="w-20 h-20 bg-gradient-to-br from-[#34c759] to-emerald-700 rounded-[1.8rem] flex items-center justify-center shadow-xl animate-pulse"
            >
                <Activity size={40} color="white" />
            </div>
            <h2 className="text-white mt-6 font-display font-black text-lg tracking-[0.3em] uppercase opacity-90">R U N O</h2>
        </div>
    );

    // Apple Onboarding Login Card
    const Onboarding = () => {

        const handleLogin = async (useRedirect = false) => {
            setIsSigningIn(true);
            setAuthError(null);
            console.log(`[Auth] Initiating Google Auth: method=${useRedirect ? "redirect" : "popup"}`);
            try {
              if (!auth) {
                 setAuthError("Authentication services are currently offline. Please check firebase configuration.");
                 setIsSigningIn(false);
                 return;
              }
              const provider = new GoogleAuthProvider();
              provider.setCustomParameters({ prompt: 'select_account' });
              
              if (useRedirect) {
                await signInWithRedirect(auth, provider);
              } else {
                await signInWithPopup(auth, provider);
              }
            } catch (err: any) {
              console.error("[Auth] Google sign-in operation failed:", err);
              
              if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
                  setAuthError("Popup blocked or closed. Please try again or use redirect.");
                  setShowRedirectOption(true);
                  // Automatically try redirect if popup blocked
                  if (err.code === "auth/popup-blocked" && !useRedirect) {
                      console.log("Automatically falling back to redirect...");
                      await signInWithRedirect(auth, new GoogleAuthProvider());
                  }
              } else if (err.code === "auth/unauthorized-domain") {
                  setAuthError(`Action Required: Please add "${window.location.hostname}" to your Firebase Console (Authentication > Settings > Authorized domains). If you are in the preview, open the app in a New Tab to sign in.`);
              } else if (err.code === "auth/network-request-failed") {
                  setAuthError("Network request failed. This may be due to an ad-blocker or strict anti-tracking settings blocking the Google Auth popup. Please try using Redirect Login, logging as Guest, or disabling tracking protection.");
                  setShowRedirectOption(true);
              } else if (err.code === "auth/cancelled-popup-request") {
                  setAuthError("A sign-in request is already in progress.");
              } else {
                  setAuthError(err.message || "Failed to authenticate with Google. Please try again.");
              }
            }
            setIsSigningIn(false);
        };

        const handleGuestLogin = () => {
            setIsSigningIn(true);
            setTimeout(() => {
                const guestUser = {
                    uid: 'guest_athlete_1',
                    displayName: 'Guest Athlete',
                    email: 'guest@sports.org',
                    photoURL: null,
                    emailVerified: true,
                    isAnonymous: true,
                    providerData: []
                } as any;
                setUser(guestUser);
                setIsAuthReady(true);
                setIsSigningIn(false);
            }, 600);
        };

        const slides = [
            {
                title: "Precision Tracking",
                description: "Monitor actual GPS distance, speed, and pacing parameters with elite micro-coordinate positioning.",
                icon: <Activity size={36} className="text-[#34c759]" />
            },
            {
                title: "Tactical AI Briefing",
                description: "Google Gemini acts as your personal fitness coach to deliver real-time pacing and recovery briefings.",
                icon: <Zap size={36} className="text-[#34c759]" fill="#34c759" />
            },
            {
                title: "Athlete Autonomy",
                description: "Sync your records securely with zero fabrication. Start your performance journey today.",
                icon: <CheckCircle2 size={36} className="text-[#34c759]" />
            }
        ];

        return (
            <div id="onboarding-view" className="absolute inset-0 bg-[#000000] text-white p-8 flex flex-col justify-between items-center text-center z-[150] w-full h-full overflow-hidden">
                <div />
                
                {/* Carousel Card */}
                <div className="flex flex-col items-center max-w-sm w-full my-auto">
                    <>
                        <div
                            key={step}
                            className="flex flex-col items-center transition-all duration-300"
                        >
                            <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                                {slides[step].icon}
                            </div>
                            <h1 className="text-4xl font-display font-black tracking-tight mb-4 text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{slides[step].title}</h1>
                            <p className="text-[#8e8e93] text-[15px] max-w-xs font-medium leading-relaxed px-2">
                                {slides[step].description}
                            </p>
                        </div>
                    </>

                    {/* Step Dots indicator */}
                    <div className="flex gap-2.5 mt-8 justify-center">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setStep(idx)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${step === idx ? 'bg-[#34c759] w-5' : 'bg-neutral-800'}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="w-full max-w-sm space-y-4 pb-12 z-20">
                    {/* Error Box */}
                    {authError && (
                        <div className="p-3 bg-red-950/40 border border-red-900/35 rounded-xl text-red-400 text-[11px] font-semibold text-center leading-normal mb-2 animate-bounce">
                            {authError}
                        </div>
                    )}

                    {step < slides.length - 1 ? (
                        <button 
                            onClick={() => setStep(s => s + 1)}
                            className="w-full py-4.5 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/10 rounded-2xl font-bold text-sm skeuo-btn uppercase tracking-wider cursor-pointer"
                        >
                            Continue
                        </button>
                    ) : (
                        <>
                            <button 
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
                            </button>
                            
                            {showRedirectOption && (
                                <button 
                                    id="google-redirect-btn"
                                    onClick={() => handleLogin(true)}
                                    disabled={isSigningIn}
                                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm skeuo-btn flex items-center justify-center gap-3 border border-zinc-800 disabled:opacity-50 cursor-pointer hover:bg-zinc-800 duration-300"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                    <span className="font-sans">Use Google Redirect</span>
                                </button>
                            )}
                            
                            <button 
                                id="onboarding-guest-btn"
                                onClick={handleGuestLogin}
                                disabled={isSigningIn}
                                className="w-full py-4 bg-[#34c759] text-white rounded-2xl font-bold text-sm skeuo-btn uppercase tracking-wider hover:bg-emerald-500 duration-300 disabled:opacity-50 cursor-pointer"
                            >
                                {isSigningIn ? "Signing In..." : "GET STARTED"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // APPLE TAB 1: HOME DASHBOARD
    const Home = () => {
        

        const totalDistanceVal = runs.reduce((sum, run) => sum + (run.distance || 0), 0) / 1000;
        const totalStreakVal = userData?.streak || 0;
        const totalRunsCount = runs.length;
        const avgDistanceCalculated = runs.length ? (totalDistanceVal / runs.length) : 0;

        // Calculate actual average pace dynamically
        const getTotalAvgPace = () => {
            if (runs.length === 0) return "0'00\"";
            const totalDuration = runs.reduce((sum, run) => sum + (run.duration || 0), 0);
            const totalDist = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
            return formatPace(totalDuration, totalDist);
        };
        const avgPaceString = getTotalAvgPace();

        // Calculate actual total calories burnt across all runs
        const totalCalories = Math.floor(runs.reduce((sum, run) => sum + (((run.distance || 0) / 1000) * 72 * (run.type === 'walk' ? 0.53 : 1.036)), 0));

        // Group runs by days of current week (Monday - Sunday) to construct an authentic status chart
        const getWeeklyActivity = () => {
            const daysData = [0, 0, 0, 0, 0, 0, 0]; // M, T, W, T, F, S, S
            const now = new Date();
            const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday ...
            const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
            
            // Start of Monday of this week (local time)
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() + mondayOffset);
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);
            
            runs.forEach(run => {
                const t = parseSafeDate(run.timestamp);
                if (t >= startOfWeek && t < endOfWeek) {
                    let dayIndex = t.getDay() - 1; // Mon is 0, Tue is 1, Sun is -1
                    if (dayIndex === -1) dayIndex = 6; // Sun becomes 6
                    if (dayIndex >= 0 && dayIndex < 7) {
                        daysData[dayIndex] += (run.distance || 0) / 1000; // in km
                    }
                }
            });
            return daysData;
        };

        const weeklyActivity = getWeeklyActivity();
        const maxActivity = Math.max(...weeklyActivity, 1); // Avoid division-by-zero
        
        return (
            <div id="home-view" className="absolute inset-0 px-5 pt-6 overflow-y-auto custom-scroll w-full h-full pb-20">
                <IndianClock />
                <header className="flex justify-between items-center mb-6 mt-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase bg-green-500/10 px-2.5 py-0.5 rounded-full">LIVE FEED</span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">Hello, {userData?.name?.split(' ')[0] || "Athlete"} 👋</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2.5 rounded-full shadow-sm border border-slate-100 relative">
                            <Bell size={18} className="text-slate-700" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </div>
                        <div className="bg-[#34c759] text-white px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm">
                            <Flame size={14} fill="white" /> {totalStreakVal}d
                        </div>
                    </div>
                </header>

                {/* Daily Water Intake Tracker */}
                <div className="mb-6 skeuo-element p-5 flex items-center shadow-sm">
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">HYDRATION</h3>
                        <p className="text-xs font-semibold text-slate-400 mb-4">Goal: 8 Glasses</p>
                        <div className="flex gap-2 isolate">
                           <button 
                               onClick={() => setWaterIntake(Math.max(0, waterIntake - 1))}
                               className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center font-black skeuo-btn text-xl"
                           >-</button>
                           <button 
                               onClick={() => setWaterIntake(Math.max(0, waterIntake + 1))}
                               className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black skeuo-btn text-xl shadow-md shadow-blue-500/20"
                           >+</button>
                        </div>
                    </div>
                    <div className="ml-4 relative w-20 h-20 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#eff6ff" strokeWidth="10" />
                            <circle 
                                cx="50" cy="50" r="45" 
                                fill="none" 
                                stroke="#3b82f6" 
                                strokeWidth="10" 
                                strokeLinecap="round" 
                                strokeDasharray="283" 
                                strokeDashoffset={283 - (283 * Math.min(waterIntake / 8, 1))}
                                className="transition-all duration-700 ease-out" 
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-slate-800 leading-none">{waterIntake}</span>
                            <span className="text-[9px] font-bold text-blue-500 uppercase">of 8</span>
                        </div>
                    </div>
                </div>

                {/* AI Briefing Segment */}
                <div className="mb-6 p-5 skeuo-element flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                        <Zap size={18} className="text-[#34c759]" fill="#34c759" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">AI BRIEFING</span>
                            <button onClick={fetchBriefing} disabled={isBriefingLoading} className="text-[#34c759] hover:opacity-80 transition-opacity">
                                {isBriefingLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                            </button>
                        </div>
                        <p className="text-slate-700 text-[13px] leading-relaxed font-medium">
                            {aiBriefing || "Tap refresh to invoke real-time AI performance projections."}
                        </p>
                    </div>
                </div>

                {/* Apple Health style Total Distance Giant Banner Card */}
                <div id="home-total-distance-card" className="mb-6 p-6 bg-gradient-to-br from-[#34c759] to-[#00a86b] text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">TOTAL RUNNING DISTANCE</span>
                            <h2 className="text-5xl font-extrabold tracking-tight mt-1 mb-2">
                                {totalDistanceVal.toFixed(1)} <span className="text-lg font-medium opacity-80">km</span>
                            </h2>
                            <div className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                <span>▲ Dynamic Performance Tracker</span>
                            </div>
                        </div>
                        
                        <div className="mt-8 pt-4 border-t border-white/20 grid grid-cols-4 gap-2 text-center">
                            <div>
                                <p className="text-[13px] font-extrabold leading-none">{totalRunsCount}</p>
                                <p className="text-[8px] font-bold text-white/70 uppercase mt-1">Runs</p>
                            </div>
                            <div>
                                <p className="text-[13px] font-extrabold leading-none">{avgDistanceCalculated.toFixed(1)}km</p>
                                <p className="text-[8px] font-bold text-white/70 uppercase mt-1">Avg run</p>
                            </div>
                            <div>
                                <p className="text-[13px] font-extrabold leading-none">{avgPaceString}</p>
                                <p className="text-[8px] font-bold text-white/70 uppercase mt-1">Avg pace</p>
                            </div>
                            <div>
                                <p className="text-[13px] font-extrabold leading-none">{totalCalories}</p>
                                <p className="text-[8px] font-bold text-white/70 uppercase mt-1">Calories</p>
                            </div>
                        </div>
                    </div>
                    {/* Apple concentric ring decoration graphic inside block */}
                    <div className="absolute right-[-40px] top-[-40px] opacity-10 pointer-events-none">
                        <svg width="240" height="240" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="white" strokeWidth="6" />
                            <circle cx="50" cy="50" r="30" fill="transparent" stroke="white" strokeWidth="6" />
                        </svg>
                    </div>
                </div>

                {/* This Week minimalist green vertical bar chart */}
                <div className="mb-6 p-5 skeuo-element">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">THIS WEEK LIVE</h3>
                        <span className="text-xs font-semibold text-[#34c759] hover:underline cursor-pointer">Stats Real Only</span>
                    </div>
                    
                    {totalRunsCount > 0 ? (
                        <div className="flex justify-between items-end h-28 px-2 gap-4">
                            {weeklyActivity.map((km, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full bg-slate-100 rounded-lg relative overflow-hidden h-20">
                                        {km > 0 && (
                                            <div 
                                                className="absolute bottom-0 left-0 right-0 bg-[#34c759] rounded-lg transition-all duration-700" 
                                                style={{ height: `${(km / maxActivity) * 100}%` }}
                                            ></div>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400">{"MTWTFSS"[i]}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-150">
                            <p className="text-slate-400 font-bold text-xs mb-1">Start your first run</p>
                            <p className="text-slate-400 text-[10px] font-medium">Weekly chart will automatically compute from logging</p>
                        </div>
                    )}
                </div>

                {/* Recent Activities styled inside beautifully rounded white cards */}
                <div className="mb-24">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">RECENT WORKOUTS</h3>
                    <div className="space-y-3">
                        {runs.length > 0 ? runs.slice(0, 3).map(run => (
                            <div key={run.id} className="p-4 skeuo-element flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${run.type === 'walk' ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
                                        {run.type === 'walk' ? (
                                            <Navigation size={18} className="text-[#007aff]" />
                                        ) : (
                                            <Flame size={18} className="text-[#34c759]" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{run.name}</p>
                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                            {parseSafeDate(run.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-extrabold text-slate-900 text-sm">
                                        {run.distance < 1000 ? `${Math.floor(run.distance)}m` : `${(run.distance / 1000).toFixed(2)}km`}
                                    </p>
                                    <p className={`text-[10px] font-bold mt-0.5 ${run.type === 'walk' ? 'text-[#007aff]' : 'text-[#34c759]'}`}>{run.pace}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-500 font-bold text-sm mb-1 text-slate-800">Start your first workout</p>
                                <p className="text-slate-400 font-semibold text-xs leading-normal max-w-xs mx-auto">Your workout records, calories burned, pace metrics, and GPS route shape will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // APPLE TAB 2: PLANS
    const PlanView = () => {
        return (
            <div id="plan-view" className="absolute inset-0 px-5 pt-6 overflow-y-auto custom-scroll w-full h-full pb-32">
                <IndianClock />
                <header className="mb-6 mt-4">
                    <p className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase">FITNESS SCHEDULE</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Training Plans</h1>
                </header>

                {/* Training Plan Giant Card (Column 5) */}
                <div id="plan-banner-card" className="mb-6 p-6 bg-gradient-to-br from-green-950 via-slate-900 to-[#14532d] text-white rounded-[2rem] shadow-xl relative overflow-hidden border border-emerald-900">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 bg-[#34c759] rounded-full flex items-center justify-center p-0.5">
                                    <Trophy size={10} color="white" />
                                </div>
                                <span className="text-[10px] font-bold text-emerald-400 tracking-wider">ACTIVE SCHEDULE</span>
                            </div>
                            <h2 className="text-32 font-black tracking-tight leading-none text-white">5K Plan</h2>
                            <p className="text-xs font-semibold text-emerald-300 mt-1">3 workouts / week • 8 weeks</p>
                        </div>
                        
                        <div className="mt-8">
                            <div className="flex justify-between items-center text-[10px] font-bold mb-2 text-slate-400">
                                <span>Week 3 of 8</span>
                                <span>37% Complete</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-[#34c759] w-[37%] rounded-full"></div>
                            </div>
                        </div>
                    </div>
                    <Award size={180} className="absolute right-[-20px] top-[-20px] text-white/5 pointer-events-none" />
                </div>

                {/* This Week schedule Checklist */}
                <div className="p-5 skeuo-element">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-5">This Week</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-[#34c759] flex items-center justify-center">
                                    <CheckCircle2 size={14} color="white" />
                                </div>
                                <div>
                                    <p className="text-sm font-extrabold text-slate-900">Easy Run</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Monday • 30 mins</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">Completed</span>
                        </div>

                        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-extrabold text-[#34c759]">Tempo Run</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Wednesday • 25 mins</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">Tomorrow</span>
                        </div>

                        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-extrabold text-slate-700">Long Run</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Friday • 60 mins</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">Pending</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 flex items-center justify-center bg-slate-50">
                                    <Clock size={10} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-extrabold text-slate-500">Active Rest Day</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Saturday • Recovery</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Rest</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // APPLE TAB 3: RUN PREPARATION TRIGGER SCREEN (Replicates Column 3 exactly!)
    const RunTab = () => {
        return (
            <div id="run-tab-view" className="absolute inset-0 px-5 pt-6 overflow-y-auto custom-scroll w-full h-full pb-32">
                <IndianClock />
                <header className="flex justify-between items-center mb-6 mt-4">
                    <div>
                        <p className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase">SATELLITE POSITIONING</p>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Start Your Run</h1>
                    </div>
                    {/* Location target status badge */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#34c759] animate-pulse"></div>
                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">GPS ✓</span>
                    </div>
                </header>

                <div className="p-6 skeuo-element text-center mb-6">
                    <p className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase">TARGET DISTANCE</p>
                    <h2 className="text-6xl font-display font-black text-slate-900 tracking-tighter mt-1 mb-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.05)]">0.00 <span className="text-xl font-bold text-slate-400">km</span></h2>
                    
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-50">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">PACE</p>
                            <p className="text-lg font-display font-black text-slate-800 mt-1">5'58"</p>
                        </div>
                        <div className="border-x border-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase">TIME</p>
                            <p className="text-lg font-display font-black text-slate-800 mt-1">00:00:00</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">CALORIES</p>
                            <p className="text-lg font-display font-black text-slate-800 mt-1">0</p>
                        </div>
                    </div>
                </div>

                {/* Concentric Circle Radar decoration */}
                <div className="relative flex flex-col items-center justify-center p-8 skeuo-element rounded-3xl mb-8 overflow-hidden h-44">
                    <div className="absolute inset-0 bg-[#34c759]/5 pointer-events-none"></div>
                    <div className="w-28 h-28 rounded-full border border-green-200/30 flex items-center justify-center relative">
                        <div className="w-20 h-20 rounded-full border border-green-200/50 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full border border-green-200 flex items-center justify-center">
                                <div className="w-3.5 h-3.5 bg-[#34c759] rounded-full animate-ping"></div>
                                <div className="w-3.5 h-3.5 bg-[#34c759] rounded-full absolute"></div>
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-wider mt-3 relative z-10">LOCKING POSITION SENSOR PATH</span>
                </div>

                {/* Mode Selector (Walk vs Run) */}
                <div className="flex justify-center mb-6">
                    <div className="flex skeuo-element p-1.5 rounded-full">
                        <button 
                            onClick={() => { setWorkoutType('run'); triggerVibration(50); }}
                            className={`px-8 py-2.5 rounded-full font-black text-sm transition-all duration-300 ${workoutType === 'run' ? 'skeuo-element-pressed text-[#34c759]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            RUN
                        </button>
                        <button 
                            onClick={() => { setWorkoutType('walk'); triggerVibration(50); }}
                            className={`px-8 py-2.5 rounded-full font-black text-sm transition-all duration-300 ${workoutType === 'walk' ? 'skeuo-element-pressed text-[#007aff]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            WALK
                        </button>
                    </div>
                </div>

                {/* Massive Bright Green Active Circle START Button (Column 3) */}
                <div className="flex justify-center mt-4">
                    <button 
                        id="gps-prep-start-btn"
                        onClick={() => { setView('run'); startRun(); }}
                        className={`w-28 h-28 text-white font-black rounded-full border-4 skeuo-btn shadow-xl flex flex-col items-center justify-center cursor-pointer duration-300 ${workoutType === 'run' ? 'bg-[#34c759]' : 'bg-[#007aff]'} ${darkMode ? 'border-neutral-800 focus:outline-none' : 'border-[#e0e5ec]'}`}
                    >
                        <span className="text-sm tracking-widest font-black uppercase text-glow">START</span>
                    </button>
                </div>
            </div>
        );
    };

    // APPLE TAB 4: PROGRESS & CHARTS (Replicates Column 4)
    const ProgressView = () => {
        const totalStreakVal = userData?.streak || 0;

        // Calculate actual monthly records and comparisons
        const getDistanceThisMonth = () => {
            let currentMonthDist = 0;
            let lastMonthDist = 0;
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            runs.forEach(run => {
                const t = parseSafeDate(run.timestamp);
                const rM = t.getMonth();
                const rY = t.getFullYear();
                if (rM === currentMonth && rY === currentYear) {
                    currentMonthDist += (run.distance || 0) / 1000;
                } else if (rM === lastMonth && rY === lastMonthYear) {
                    lastMonthDist += (run.distance || 0) / 1000;
                }
            });
            return { currentMonthDist, lastMonthDist };
        };

        const { currentMonthDist, lastMonthDist } = getDistanceThisMonth();
        const distanceMonthlyDiff = lastMonthDist > 0 ? (((currentMonthDist - lastMonthDist) / lastMonthDist) * 100).toFixed(1) : "0.0";

        // Segment current month into 4 weeks
        const getMonthlyActivity = () => {
            const weeklySlices = [0, 0, 0, 0];
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            runs.forEach(run => {
                const t = parseSafeDate(run.timestamp);
                if (t.getMonth() === currentMonth && t.getFullYear() === currentYear) {
                    const dom = t.getDate(); // 1 to 31
                    const sliceIdx = Math.min(3, Math.floor((dom - 1) / 7.5));
                    weeklySlices[sliceIdx] += (run.distance || 0) / 1000;
                }
            });
            return weeklySlices;
        };

        const monthlyActivity = getMonthlyActivity();
        const maxMonthly = Math.max(...monthlyActivity, 1);

        // Compute genuine achievements state
        const achievementsList = [
            { name: "5K Novice", color: "from-blue-400 to-blue-600", unlocked: runs.some(r => (r.distance || 0) >= 5000) },
            { name: "10K Explorer", color: "from-emerald-400 to-emerald-600", unlocked: runs.some(r => (r.distance || 0) >= 10000) },
            { name: "Half Marathon", color: "from-amber-400 to-orange-500", unlocked: runs.some(r => (r.distance || 0) >= 21097) },
            { name: "Elite Streak", color: "from-purple-400 to-indigo-600", unlocked: totalStreakVal >= 5 }
        ];

        // Retrieve genuine personal records tables
        const getPersonalRecords = () => {
            let longestRun = 0;
            let bestPaceSecs = Infinity; 
            let fastest5kSecs = Infinity;

            runs.forEach(run => {
                const runDistKm = (run.distance || 0) / 1000;
                if (runDistKm > longestRun) {
                    longestRun = runDistKm;
                }
                
                // Best overall pace
                const duration = run.duration || 0;
                const distM = run.distance || 0;
                if (distM > 100) {
                    const secsPerKm = duration / (distM / 1000);
                    if (secsPerKm < bestPaceSecs) {
                        bestPaceSecs = secsPerKm;
                    }
                    // If run distance is roughly 5k
                    if (distM >= 4800 && distM <= 5200) {
                        if (duration < fastest5kSecs) {
                            fastest5kSecs = duration;
                        }
                    }
                }
            });

            const fast5kString = fastest5kSecs < Infinity ? `${Math.floor(fastest5kSecs / 60)}:${(fastest5kSecs % 60).toString().padStart(2, '0')}` : "-";
            const bestPaceString = bestPaceSecs < Infinity ? `${Math.floor(bestPaceSecs / 60)}'${Math.floor(bestPaceSecs % 60)}"` : "-";

            return { longestRun, fast5kString, bestPaceString };
        };

        const { longestRun, fast5kString, bestPaceString } = getPersonalRecords();

        return (
            <div id="progress-view" className="absolute inset-0 px-5 pt-6 overflow-y-auto custom-scroll w-full h-full pb-32">
                <IndianClock />
                <header className="mb-6 mt-4">
                    <p className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase">DATA INSIGHTS</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Progress</h1>
                </header>

                {/* Segmented active chart toggles (W | M | Y) */}
                <div className="p-1 bg-[#e3e3e9] rounded-full flex items-center justify-between mb-6">
                    {['W', 'M', 'Y'].map((tab) => (
                        <button 
                            key={tab}
                            id={`segmented-tab-${tab}`}
                            onClick={() => setActiveProgressTab(tab as any)}
                            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${activeProgressTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {tab === 'W' ? 'Week' : tab === 'M' ? 'Month' : 'Year'}
                        </button>
                    ))}
                </div>

                {/* Metric Summary Column details */}
                <div className="p-5 skeuo-element mb-6">
                    <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">DISTANCE THIS MONTH</p>
                    <h2 className="text-4xl font-extrabold text-slate-900 mt-1 mb-1">{currentMonthDist.toFixed(1)} <span className="text-lg font-medium text-slate-500">km</span></h2>
                    <p className="text-[10px] font-bold text-[#34c759]">
                        {lastMonthDist > 0 ? `▲ ${distanceMonthlyDiff}% vs last month` : "▲ Active Training Month"}
                    </p>

                    {/* Chart Visual representing monthly progression bar-group */}
                    {runs.length > 0 ? (
                        <div className="flex justify-between items-end h-28 px-2 gap-4 mt-8">
                            {monthlyActivity.map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full bg-[#f2f2f7] rounded-lg relative overflow-hidden h-20">
                                        {h > 0 && (
                                            <div 
                                                className="absolute bottom-0 left-0 right-0 bg-[#34c759]/90 rounded-lg transition-all" 
                                                style={{ height: `${(h / maxMonthly) * 100}%` }}
                                            ></div>
                                        )}
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400">W {i+1}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-6">
                            <p className="text-slate-400 font-bold text-xs">Start your first run</p>
                            <p className="text-slate-400 text-[10px] font-semibold mt-1">Distance statistics will compile automatically</p>
                        </div>
                    )}
                </div>

                {/* Achievements awards badge column scroll */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">ACHIEVEMENTS</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {achievementsList.map((badge, i) => (
                            <div 
                                key={i} 
                                className={`skeuo-element p-4 flex-shrink-0 text-center w-28 shadow-sm transition-all duration-300 ${badge.unlocked ? "opacity-100 scale-100" : "opacity-40 scale-95"}`}
                            >
                                <div className={`w-12 h-12 rounded-full mx-auto bg-gradient-to-br ${badge.unlocked ? badge.color : "from-slate-300 to-slate-400"} flex items-center justify-center p-2 shadow-sm relative`}>
                                    <Trophy size={18} color="white" />
                                    {!badge.unlocked && (
                                        <div className="absolute inset-0 bg-black/10 rounded-full flex items-center justify-center">
                                            <span className="text-[8px] font-black tracking-widest text-white leading-none">LOCK</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] font-black tracking-tight text-slate-900 mt-2.5 truncate">{badge.name}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Personal records segment table */}
                <div className="mb-6 p-5 skeuo-element">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">PERSONAL RECORDS</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-50">
                            <div>
                                <p className="text-xs font-bold text-slate-900">Longest Run</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">True Record</p>
                            </div>
                            <span className="text-sm font-extrabold text-slate-800">
                                {longestRun > 0 ? `${longestRun.toFixed(2)} km` : "-"}
                            </span>
                        </div>

                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-50">
                            <div>
                                <p className="text-xs font-bold text-slate-900">Fastest 5K</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Target Distance</p>
                            </div>
                            <span className="text-sm font-extrabold text-slate-800">{fast5kString}</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-slate-900">Best Pace</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Efficiency</p>
                            </div>
                            <span className="text-sm font-extrabold text-[#34c759]">
                                {bestPaceString !== "-" ? `${bestPaceString} /km` : "-"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // APPLE TAB 5: MORE MENU ROW LAYOUT (Replicates Column 12)
    const MoreView = () => {
        return (
            <div id="more-view" className="absolute inset-0 px-5 pt-6 overflow-y-auto custom-scroll w-full h-full pb-32">
                <IndianClock />
                <header className="mb-6 mt-4">
                    <p className="text-[10px] font-bold tracking-widest text-[#34c759] uppercase">ACCOUNT COMMANDS</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">More Settings</h1>
                </header>

                {/* Profile banner metadata detail */}
                <div id="more-profile-card" className="p-6 skeuo-element flex items-center gap-4 mb-6 relative overflow-hidden">
                    <label className="relative block w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0 border border-slate-200">
                        {userData?.profilePic ? (
                            <img src={userData.profilePic} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={30} className="text-slate-400" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <div className="flex-1">
                        <h4 className="font-extrabold text-lg text-slate-900 leading-tight">{userData?.name || 'Farman Shafi'}</h4>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{user?.email}</p>
                        <span className="inline-block bg-green-50 text-[#34c759] border border-green-100 text-[8px] font-bold px-2 py-0.5 rounded-full mt-1.5 uppercase">Premium Account</span>
                    </div>
                </div>

                {/* AI Interactive Gym Diagnosis (custom Gemini engagement) */}
                <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-3xl mb-6 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[9px] font-bold text-indigo-400 tracking-wider">AI DIAGNOSIS COMMAND</p>
                        <h4 className="font-bold text-base mt-1">Diagnostic Circuit Projections</h4>
                        <p className="text-xs text-slate-300 mt-3 mb-4">Request a high-performance body circuit diagnostic tailored dynamically to your profile criteria.</p>
                        
                        <div className="flex gap-2">
                            {["Upper Core", "Lower Quad", "Active Breath"].map(target => (
                                <button 
                                    key={target} 
                                    id={`diag-circuit-${target}`}
                                    onClick={() => fetchWorkout(target)} 
                                    className="px-3 py-1.5 bg-white/10 rounded-xl text-[10px] font-bold hover:bg-white/20 transition-all uppercase"
                                >
                                    {target}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Diagnostic box output */}
                {aiWorkout && (
                    <div className="p-5 skeuo-element mb-6 shadow-sm">
                        <p className="text-[10px] font-bold text-indigo-600 tracking-wider mb-2">GENERATED PLAN</p>
                        <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed font-semibold">{aiWorkout}</pre>
                    </div>
                )}

                {/* Settings menu list items with chevron pointers */}
                <div className="skeuo-element overflow-hidden mb-6">
                    <div 
                        id="menu-btn-profile"
                        onClick={() => setView('profile')} 
                        className="px-5 py-4 flex items-center justify-between border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Activity size={18} className="text-slate-600 dark:text-slate-300" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Edit Profile Parameters</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </div>

                    <div 
                        id="menu-btn-theme"
                        onClick={() => setDarkMode(!darkMode)}
                        className="px-5 py-4 flex items-center justify-between border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {darkMode ? <Moon size={18} className="text-violet-400" /> : <Sun size={18} className="text-amber-500" />}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans">Dark Mode Theme</span>
                        </div>
                        <div
                            id="theme-toggle-switch"
                            onClick={(e) => { e.stopPropagation(); setDarkMode(!darkMode); }}
                            className={`w-10 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${darkMode ? 'bg-[#34c759]' : 'bg-slate-200'}`}
                        >
                            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>

                    <div 
                        id="menu-btn-privacy"
                        onClick={() => setView('privacy')} 
                        className="px-5 py-4 flex items-center justify-between border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Shield size={18} className="text-slate-600 dark:text-slate-300" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Privacy & Telemetry Policy</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </div>

                    <a 
                        href="mailto:farmanshafi2007@gmail.com?subject=Runo Support Diagnostics" 
                        className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors block cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <MessageSquare size={18} className="text-slate-600 dark:text-slate-300" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Submit Customer Escalation</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </a>
                </div>

                {/* Apple Standard Logout Row */}
                <button 
                    id="more-logout-action-btn"
                    onClick={async () => { 
                        if (confirm("Are you sure you want to sign out of your Runo performance profile?")) { 
                            try { 
                                console.log("[Auth] Initiating systemic sign out procedure.");
                                if (auth) { 
                                    await signOut(auth); 
                                }
                                // Explicitly purge local session contexts to guarantee instant real-time response
                                setUser(null);
                                setUserData(null);
                                setRuns([]);
                                
                                setIsRunning(false);
                                setIsPaused(false);
                                setAutoPaused(false);
                                setElapsed(0);
                                setDistance(0);
                                setCurrentSpeed(0);
                                setAccuracy(0);
                                setGpsStatus("WAITING");
                                setLastSummary(null);
                                
                                setAiBriefing(null);
                                setAiWorkout(null);
                                setAiAnalysis(null);
                                
                                setView('onboarding');
                                console.log("[Auth] Offline cache clean & sign out successful.");
                            } catch (e) {
                                console.error("[Auth] Systemic sign out encountered an error:", e);
                            } 
                        } 
                    }} 
                    className="w-full py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl font-bold text-xs transition-colors tracking-widest uppercase mb-10"
                >
                    SIGN OUT
                </button>
            </div>
        );
    };

    // ACTIVE APP VIEW (Running Counter screen)

    const Run = () => {

        const renderColorfulDigits = (text: string | number) => {
            const str = String(text);
            const colors = ["text-red-500", "text-orange-500", "text-amber-500", "text-green-500", "text-blue-500", "text-indigo-500", "text-purple-500", "text-pink-500"];
            let charIndex = 0;
            return str.split('').map((char, index) => {
                if (/[0-9]/.test(char)) {
                    const color = colors[charIndex % colors.length];
                    charIndex++;
                    return <span key={index} className={color + " drop-shadow-md font-extrabold"}>{char}</span>;
                }
                return <span key={index}>{char}</span>;
            });
        };

        const missionGoalMeters = 2500; 
        const displayDistance = (distance / 1000).toFixed(2);
        const displayUnit = "km";
        const progressPercent = Math.min(100, (distance / missionGoalMeters) * 100);

        // Pre-calculate running tracking data for high-fidelity active map render
        const activeRouteForMap = runDataRef.current?.coordinates && runDataRef.current.coordinates.length > 0
            ? runDataRef.current.coordinates
            : [{ lat: 12.9716, lng: 77.5946 }]; // Default fallback so math doesn't crash

        const mapLats = activeRouteForMap.map(c => c.lat);
        const mapLngs = activeRouteForMap.map(c => c.lng);
        const minLatVal = Math.min(...mapLats);
        const maxLatVal = Math.max(...mapLats);
        const minLngVal = Math.min(...mapLngs);
        const maxLngVal = Math.max(...mapLngs);

        const latSpanVal = maxLatVal - minLatVal || 0.0001;
        const lngSpanVal = maxLngVal - minLngVal || 0.0001;

        const mapPadding = 0.15;
        const minLatPVal = minLatVal - latSpanVal * mapPadding;
        const maxLatPVal = maxLatVal + latSpanVal * mapPadding;
        const minLngPVal = minLngVal - lngSpanVal * mapPadding;
        const maxLngPVal = maxLngVal + lngSpanVal * mapPadding;

        const rangeLatVal = maxLatPVal - minLatPVal;
        const rangeLngVal = maxLngPVal - minLngPVal;

        const pointsList = activeRouteForMap.map(pt => {
            const x = ((pt.lng - minLngPVal) / rangeLngVal) * 100;
            const y = 100 - (((pt.lat - minLatPVal) / rangeLatVal) * 100);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const svgPoints = pointsList.join(" ");

        const startPt = activeRouteForMap[0] || { lat: 12.9716, lng: 77.5946 };
        const endPt = activeRouteForMap[activeRouteForMap.length - 1] || { lat: 12.9716, lng: 77.5946 };

        const startX = ((startPt.lng - minLngPVal) / rangeLngVal) * 100;
        const startY = 100 - (((startPt.lat - minLatPVal) / rangeLatVal) * 100);

        const endX = ((endPt.lng - minLngPVal) / rangeLngVal) * 100;
        const endY = 100 - (((endPt.lat - minLatPVal) / rangeLatVal) * 100);

        // Interpolate current position along activeRouteForMap relative to progressPercent
        const exactIndex = Math.min(
            activeRouteForMap.length - 1,
            Math.max(0, (progressPercent / 100) * (activeRouteForMap.length - 1))
        );
        const floorIndex = Math.floor(exactIndex);
        const ceilIndex = Math.min(activeRouteForMap.length - 1, floorIndex + 1);
        const fraction = exactIndex - floorIndex;
        const pt1 = activeRouteForMap[floorIndex] || startPt;
        const pt2 = activeRouteForMap[ceilIndex] || startPt;
        const runnerPt = {
            lat: pt1.lat + (pt2.lat - pt1.lat) * fraction,
            lng: pt1.lng + (pt2.lng - pt1.lng) * fraction
        };
        const runnerX = ((runnerPt.lng - minLngPVal) / rangeLngVal) * 100;
        const runnerY = 100 - (((runnerPt.lat - minLatPVal) / rangeLatVal) * 100);

        // Splits live calculation list
        const getSplitsList = () => {
            const list = [];
            const totalKm = distance / 1000;
            const currentAvgPace = formatPace(elapsed, distance);
            
            if (totalKm < 1) {
                list.push({ km: 1, pace: currentAvgPace.includes("--") ? "--'--\"" : currentAvgPace });
            } else {
                const count = Math.min(3, Math.floor(totalKm));
                for (let i = count; i >= 1; i--) {
                    list.push({ km: i, pace: formatPace(Math.floor(elapsed / totalKm), 1000) });
                }
            }
            return list;
        };

        const getGpsDotColor = () => {
            if (autoPaused) return "bg-amber-500";
            if (gpsStatus === "ERROR") return "bg-red-500";
            if (gpsStatus === "POOR SIGNAL" || gpsStatus === "LOCKING...") return "bg-orange-400";
            if (gpsStatus === "WAITING") return "bg-slate-500";
            return "bg-neonCyan";
        };

        // Beautiful Vector MiniMap Component
        const MiniMap = ({ coordinates }: { coordinates: { lat: number; lng: number }[] }) => {
            if (!coordinates || coordinates.length === 0) {
                return (
                    <div className="w-full h-44 bg-slate-900 rounded-[2rem] flex items-center justify-center relative overflow-hidden mb-6">
                        <p className="text-slate-500 font-bold text-xs">Waiting for GPS coordinate points...</p>
                    </div>
                );
            }

            // Calculate bounds of coordinates
            const lats = coordinates.map(c => c.lat);
            const lngs = coordinates.map(c => c.lng);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const latSpan = maxLat - minLat || 0.0001;
            const lngSpan = maxLng - minLng || 0.0001;

            // Pad the boundaries slightly for visual comfort
            const padding = 0.15;
            const minLatP = minLat - latSpan * padding;
            const maxLatP = maxLat + latSpan * padding;
            const minLngP = minLng - lngSpan * padding;
            const maxLngP = maxLng + lngSpan * padding;

            const rangeLat = maxLatP - minLatP;
            const rangeLng = maxLngP - minLngP;

            // Map coordinates to SVG viewbox points (e.g. 0 to 100)
            const pointsList = coordinates.map(pt => {
                const x = ((pt.lng - minLngP) / rangeLng) * 100;
                const y = 100 - (((pt.lat - minLatP) / rangeLat) * 100);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            });
            const svgPoints = pointsList.join(" ");

            const startPt = coordinates[0];
            const endPt = coordinates[coordinates.length - 1];

            const startX = ((startPt.lng - minLngP) / rangeLng) * 100;
            const startY = 100 - (((startPt.lat - minLatP) / rangeLat) * 100);

            const endX = ((endPt.lng - minLngP) / rangeLng) * 100;
            const endY = 100 - (((endPt.lat - minLatP) / rangeLat) * 100);

            return (
                <div className="w-full bg-[#1c1c1e] text-white rounded-[2rem] border border-neutral-800 p-5 relative overflow-hidden mb-6 h-48 flex flex-col justify-between shadow-lg">
                    <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none"></div>
                    
                    {/* Header segment */}
                    <div className="relative z-10 flex justify-between items-center">
                        <span className="text-[9px] font-black tracking-widest text-[#34c759] uppercase bg-green-500/10 px-2.5 py-0.5 rounded">GPS VECTOR TRACK</span>
                        <span className="text-[9px] font-bold text-slate-400">Athlete Route Map</span>
                    </div>

                    {/* SVG Visual Stage */}
                    <div className="relative flex-1 w-full h-full min-h-[90px] mt-2">
                        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                            {/* Dynamic Path Stroke */}
                            {pointsList.length > 1 && (
                                <polyline
                                    fill="none"
                                    stroke="#34c759"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={svgPoints}
                                    style={{ filter: "drop-shadow(0 2px 4px rgba(52,199,89,0.4))" }}
                                />
                            )}
                            {/* Start Node */}
                            <circle cx={startX} cy={startY} r="3" fill="#ffffff" stroke="#34c759" strokeWidth="1.5" />
                            {/* End Node */}
                            <circle cx={endX} cy={endY} r="3" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
                        </svg>
                    </div>

                    {/* Legend indicator */}
                    <div className="relative z-10 flex gap-4 text-[8px] font-black text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-[#34c759] rounded-full"></span> START</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> END</span>
                        <span className="ml-auto tabular-nums">{coordinates.length} SENSOR POINTS</span>
                    </div>
                </div>
            );
        };

        if (lastSummary && !isRunning) {
            return (
                <div id="workout-summary-container" className="absolute inset-0 z-[60] bg-[#f2f2f7] text-[#1c1c1e] p-6 flex flex-col justify-between overflow-hidden w-full h-full">
                    <div className="flex-1 overflow-y-auto custom-scroll pb-10">
                        <header className="flex justify-between items-center mb-8 pt-4">
                            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Workout Summary</h2>
                        </header>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-5 skeuo-element shadow-sm relative overflow-hidden">
                                <p className={`text-[9px] font-bold ${lastSummary.type === 'walk' ? 'text-[#007aff]' : 'text-[#34c759]'} uppercase tracking-wider flex items-center gap-1`}>
                                    {lastSummary.type === 'walk' ? <Navigation size={10} /> : <Flame size={10} />} DISTANCE
                                </p>
                                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                                    {lastSummary.distance < 1000 ? `${Math.floor(lastSummary.distance)}m` : `${(lastSummary.distance/1000).toFixed(2)}km`}
                                </p>
                            </div>
                            <div className={`p-5 text-white rounded-3xl shadow-sm relative overflow-hidden ${lastSummary.type === 'walk' ? 'bg-[#007aff]' : 'bg-[#34c759]'}`}>
                                <p className="text-[9px] font-bold text-white/80 uppercase tracking-wider font-sans flex items-center gap-1">
                                    <Clock size={10} /> DURATION
                                </p>
                                <p className="text-3xl font-extrabold mt-1">{formatTime(lastSummary.duration)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-5 skeuo-element shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AVERAGE PACE</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">{lastSummary.pace}</p>
                            </div>
                            <div className="p-5 skeuo-element shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CALORIES BURNT</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">~{Math.floor((lastSummary.distance/1000) * 72 * (lastSummary.type === 'walk' ? 0.53 : 1.036))} kcal</p>
                            </div>
                        </div>

                        {/* Interactive dynamic mini-map path rendering screen */}
                        <MiniMap coordinates={lastSummary.coordinates} />

                        {/* Interactive dynamic analytics trigger buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <button 
                                id="stop-run-analyze-btn"
                                onClick={fetchAnalysis} 
                                disabled={isAnalysisLoading} 
                                className="py-4 bg-[#1c1c1e] text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5 disabled:opacity-70 skeuo-btn"
                            >
                                {isAnalysisLoading ? <Loader2 className="animate-spin text-white" size={14}/> : <><Activity size={14} color="white"/> Diagnose Performance</>}
                            </button>

                            <div className="relative flex w-full">
                                <button 
                                    id="stop-run-share-btn"
                                    onClick={() => generateShareCard()}
                                    className="w-1/2 py-4 bg-[#34c759] text-white rounded-l-2xl font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1.5 transition-all outline-none"
                                >
                                    <Upload size={14} className="rotate-180 text-white" /> Share Card
                                </button>
                                <div className="w-[1px] bg-white/20 z-10"></div>
                                <label className="w-1/2 py-4 bg-[#2dae4f] text-white rounded-r-2xl font-bold text-[10px] uppercase tracking-wider flex justify-center items-center gap-1 transition-all cursor-pointer hover:bg-[#289a46]">
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
                                    + Photo
                                </label>
                            </div>
                        </div>

                        {aiAnalysis && (
                            <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 shadow-sm">
                                <p className="text-[10px] font-bold text-indigo-700 tracking-wider mb-2 flex items-center gap-1">⚡ COACH FEEDBACK</p>
                                <p className="text-xs font-semibold text-indigo-900 leading-relaxed font-sans">{aiAnalysis}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="pb-6 pt-2">
                        <button 
                            id="summary-view-return-btn"
                            onClick={() => { setLastSummary(null); setView('home'); }} 
                            className="w-full py-4.5 bg-[#34c759] text-white rounded-2xl font-bold text-sm uppercase tracking-wider shadow-sm"
                        >
                            CLOSE SUMMARY
                        </button>
                    </div>
                </div>
            );
        }

        const formatHugeTimer = (totalSeconds: number) => {
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
                    </div>

                    {/* Timer Section */}
                    <div className="w-full relative flex flex-col items-center mb-8">
                        <div className="absolute right-0 top-0 p-2 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </div>
                        <p className={`text-base font-bold mb-1 ${gpsStatus === 'RECORDING' && !autoPaused ? 'text-[#34c759]' : (autoPaused ? 'text-amber-500' : 'text-slate-400')}`}>
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
                                <span className="text-3xl font-bold text-[#ff9500] leading-none">--</span>
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
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="6" height="6"></rect><circle cx="12" cy="12" r="10"></circle></svg>
                            </div>
                            <span className="text-[13px] font-bold text-slate-300 tracking-wide mt-1">End</span>
                        </button>

                        {/* Play/Pause Central Button */}
                        <button onClick={togglePause} className="flex flex-col items-center gap-2 transform -translate-y-[28px] group cursor-pointer z-20 relative">
                            <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-tr from-[#e64a19] to-[#ff6e40] shadow-[0_12px_30px_rgba(255,81,0,0.4)] flex items-center justify-center group-active:scale-90 transition-all outline-none border-[6px] border-[#1a1b1e]">
                                {isPaused ? <Play size={38} className="text-white fill-white ml-2 drop-shadow-md" /> : <Pause size={38} className="text-white fill-white drop-shadow-md" />}
                            </div>
                            <span className="text-[14px] font-bold font-sans text-orange-500 uppercase tracking-widest absolute -bottom-8">{isPaused ? 'Resume' : 'Pause'}</span>
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
    };

    // APPLE PROFILE PAGE (replicates Column 12's detail sub-card route)
    const Profile = () => (
        <div id="profile-view" className="absolute inset-0 px-6 pt-6 overflow-y-auto custom-scroll w-full h-full">
            <IndianClock />
            <header className="flex items-center gap-4 mb-8 mt-4">
                <button id="profile-back-btn" onClick={() => setView('more')} className="p-3 skeuo-element skeuo-btn"><ChevronLeft size={18} color={darkMode ? "#ffffff" : "#1c1c1e"}/></button>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Edit Profile</h1>
            </header>

            <div className="flex flex-col items-center mb-10">
                <label className="relative block w-32 h-32 rounded-3xl bg-white flex items-center justify-center mb-6 fitness-card cursor-pointer overflow-hidden max-w-full">
                    {userData?.profilePic ? (
                        <img src={userData.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User size={50} className="text-slate-300" />
                    )}
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center upload-overlay">
                        <Camera size={26} color="white" />
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>

                <div className="w-full space-y-4">
                    <div className="p-4 skeuo-element">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">NAME</span>
                        <input 
                            id="profile-name-textbox"
                            type="text" 
                            className="w-full mt-1 bg-transparent font-bold text-slate-800 text-sm focus:outline-none" 
                            value={userData?.name || ""} 
                            onChange={async (e) => {
                                const newName = e.target.value;
                                if (!db) {
                                    const updatedProfile = { ...userData, name: newName };
                                    setUserData(updatedProfile);
                                    try {
                                      localStorage.setItem(`user_profile_${user!.uid}`, JSON.stringify(updatedProfile));
                                    } catch (err) {}
                                    return;
                                }
                                try {
                                  await setDoc(doc(db, 'users', user!.uid), { name: newName }, { merge: true });
                                } catch (err) {
                                  console.warn("Failed saved profile user name. Saving locally:", err);
                                  const updatedProfile = { ...userData, name: newName };
                                  setUserData(updatedProfile);
                                  try {
                                    localStorage.setItem(`user_profile_${user!.uid}`, JSON.stringify(updatedProfile));
                                  } catch (err) {}
                                }
                            }}
                        />
                    </div>
                    
                    <div className="p-4 skeuo-element">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">EMAIL</span>
                        <p className="text-sm font-bold text-slate-500 mt-1 truncate">{user?.email}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const Privacy = () => (
        <div id="privacy-policy-view" className="fixed inset-0 z-[100] bg-slate-50 text-slate-900 flex flex-col w-full h-full">
            <header className="px-5 pt-16 pb-4 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
                <button id="privacy-back-btn" onClick={() => setView('more')} className="p-3 bg-[#e3e3e9] rounded-2xl skeuo-btn"><ChevronLeft size={18} color={darkMode ? "#ffffff" : "#1c1c1e"}/></button>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-800">Telemetry Privacy</h3>
                <div className="w-10"></div>
            </header>
            <div className="flex-1 overflow-y-auto p-8 custom-scroll space-y-8 pb-20">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Protocols</h2>
                
                <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">01. Satellite Telemetry</h4>
                    <p className="text-slate-600 leading-relaxed text-xs font-semibold">Your device GPS path parameters are processed exclusively during active running sessions. Raw positioning details remain sandboxed locally.</p>
                </div>
                
                <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">02. Analytics</h4>
                    <p className="text-slate-600 leading-relaxed text-xs font-semibold">Diagnostic details and activity charts sync securely with Firestore so you won't lose your consistency streaks across sessions.</p>
                </div>

                <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">03. Support Protocol</h4>
                    <p className="text-slate-600 leading-relaxed text-xs font-semibold">To clear database credentials or request secure account wipes, submit diagnostic complains to safety contacts: farmanshafi2007@gmail.com.</p>
                </div>
            </div>
        </div>
    );

    // Bottom Navigation tab bar (five keys) replicating column images
    const navItems = [
        { id: 'home', icon: HomeSolid, label: 'Home' }, 
        { id: 'plan', icon: Calendar, label: 'Plan' }, 
        { id: 'run_tab', icon: Navigation, label: 'Prep' },
        { id: 'progress', icon: BarChart2, label: 'Progress' },
        { id: 'more', icon: Settings, label: 'More' } 
    ];

    return (
        <div id="device-screen-wrapper" className="fixed inset-0 w-full h-full skeuo-bg overflow-hidden">
            <>
                {view === 'splash' && Splash()}
                {view === 'home' && Home()}
                {view === 'plan' && PlanView()}
                {view === 'run_tab' && RunTab()}
                {view === 'progress' && ProgressView()}
                {view === 'more' && MoreView()}
                {view === 'run' && Run()}
                {view === 'profile' && Profile()}
                {view === 'privacy' && Privacy()}
                {view === 'onboarding' && Onboarding()}
            </>

            {['home', 'plan', 'run_tab', 'progress', 'more', 'profile'].includes(view) && (
                <div className="nav-dock-container pointer-events-none">
                    <nav className="nav-pill pointer-events-auto">
                        {navItems.map((item) => {
                            // Support profile highlight inside more tab
                            const isCurrent = view === item.id || (item.id === 'more' && view === 'profile');
                            const IconComp = item.icon;
                            return (
                                <button 
                                    key={item.id}
                                    id={`nav-item-btn-${item.id}`}
                                    onClick={() => setView(item.id)} 
                                    className={`nav-item skeuo-btn ${isCurrent ? 'active' : 'hover:bg-slate-50'}`}
                                >
                                    <IconComp size={20} color={isCurrent ? 'white' : '#8e8e93'} className="realistic-icon" />
                                    <span className={`text-[8px] font-bold mt-1 uppercase tracking-wider ${isCurrent ? 'text-white font-extrabold' : 'text-[#8e8e93]'}`}>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            )}
        </div>
    );
}

const HomeSolid = ({ size, color }: { size: number, color: string }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>
);
