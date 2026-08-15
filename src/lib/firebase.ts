import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

// Let the Firebase SDK automatically choose the most reliable transport for the
// current network. This is safer than forcing long-polling on every browser and
// fixes cases where a browser reports Firestore as "client is offline" even while
// normal internet access is available.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    },
    databaseId
  );
} catch {
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

    // Auth is optional for the current Firestore rules. Do not make a slow Auth
    // request prevent the app from reaching Firestore.
    const fallbackTimer = setTimeout(() => {
      console.warn('Firebase Auth timed out; continuing without Auth.');
      finish(null);
    }, 2000);

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (settled) return;
      clearTimeout(fallbackTimer);

      if (user) {
        finish(user);
        return;
      }

      try {
        const cred = await signInAnonymously(auth);
        finish(cred.user);
      } catch (err) {
        console.warn('Anonymous Firebase Auth unavailable; continuing with Firestore:', err);
        finish(null);
      }
    });
  });

  return authInitPromise;
}

ensureFirebaseAuth().catch((err) => {
  console.warn('Firebase auth initialization warning:', err);
});
