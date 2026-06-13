/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Safely attempt to load firebase config using Vite's glob import to prevent build crashes on GitHub
const configFiles = import.meta.glob('../firebase-applet-config.json', { eager: true });
const configKey = Object.keys(configFiles)[0];
const firebaseConfig = configKey ? (configFiles[configKey] as any).default : null;

console.log("[Firebase Init] Starting audit of Firebase configuration...");

let app: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseAvailable = false;
let firebaseInitError: string | null = null;

try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    
    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
    
    auth = getAuth(app);
    // Explicitly enforce local persistence for robust sessions
    setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence Auth Error:", e));
    
    isFirebaseAvailable = true;
  } else {
    throw new Error("Missing required config attributes");
  }
} catch (error: any) {
  firebaseInitError = error?.message || String(error);
}

export { db, auth, isFirebaseAvailable, firebaseInitError };

