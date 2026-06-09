import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseAvailable = false;
let firebaseInitError: string | null = null;

try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId);
    auth = getAuth(app);
    isFirebaseAvailable = true;
  } else {
    throw new Error("Firebase config has empty projectId or apiKey.");
  }
} catch (error: any) {
  console.warn("Firebase failed to initialize cleanly. Running in high-fidelity sandbox mode:", error);
  firebaseInitError = error?.message || String(error);
}

export { db, auth, isFirebaseAvailable, firebaseInitError };

