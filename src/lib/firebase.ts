import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

// Use long-polling for Firestore. This is intentionally enabled for the terminal
// because some Wi-Fi/mobile networks block or interfere with Firestore's default
// WebChannel transport. Long-polling is slower but much more reliable across
// different phones, tablets and PCs/networks.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    },
    databaseId
  );
} catch {
  // The Firebase app may already have initialized Firestore elsewhere.
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db: Firestore = firestoreInstance;
export const auth = getAuth(app);

let authInitPromise: Promise<User | null> | null = null;

export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (authInitPromise) return authInitPromise;

  authInitPromise = new Promise<User | null>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      resolve(user);
    };

    // Authentication is not required by the current Firestore rules, so never
    // allow a Firebase Auth problem to block Firestore synchronization.
    const fallbackTimer = setTimeout(() => {
      console.warn('Firebase Auth unavailable; continuing with Firestore access.');
      finish(null);
    }, 1500);

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(fallbackTimer);
      if (user) {
        finish(user);
        return;
      }

      try {
        const cred = await signInAnonymously(auth);
        finish(cred.user);
      } catch (err) {
        console.warn('Firebase anonymous auth unavailable; Firestore sync will continue:', err);
        finish(null);
      }
    });
  });

  return authInitPromise;
}

// Warm up the Firebase session without making app startup depend on Auth.
ensureFirebaseAuth()
  .then((user) => {
    if (user) {
      console.log('Firebase Auth initialized for terminal session uid:', user.uid);
    } else {
      console.log('Firebase terminal session running without Auth; Firestore remains enabled.');
    }
  })
  .catch((err) => {
    console.warn('Firebase auth initialization warning:', err);
  });
