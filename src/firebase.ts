/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Safely attempt to load firebase config using Vite's glob import to prevent build crashes on GitHub
const configFiles = import.meta.glob('../firebase-applet-config.json', { eager: true });
const configKey = Object.keys(configFiles)[0];
const firebaseConfig = configKey ? (configFiles[configKey] as any).default : null;

console.log("[Firebase Init] Starting audit of Firebase configuration...");
console.log("[Firebase Init] Project ID:", firebaseConfig?.projectId);
console.log("[Firebase Init] Auth Domain:", firebaseConfig?.authDomain);
console.log("[Firebase Init] Firestore DB ID:", (firebaseConfig as any)?.firestoreDatabaseId);

let app: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseAvailable = false;
let firebaseInitError: string | null = null;

try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
    console.log("[Firebase Init] Initializing Firebase App instance...");
    app = initializeApp(firebaseConfig);
    
    console.log("[Firebase Init] Specifying custom Firestore settings with experimentalForceLongPolling for reliable container connectivity...");
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId);
    
    console.log("[Firebase Init] Spawning Firebase Auth handler...");
    auth = getAuth(app);
    
    isFirebaseAvailable = true;
    console.log("[Firebase Init] Firebase services successfully loaded & mapped.");
  } else {
    throw new Error("Missing required config attributes in firebase-applet-config.json. Validate that projectId and apiKey are present.");
  }
} catch (error: any) {
  console.error("[Firebase Init] Diagnostic Critical Failure. Falling back to offline sandbox mode:", error);
  firebaseInitError = error?.message || String(error);
}

export { db, auth, isFirebaseAvailable, firebaseInitError };

