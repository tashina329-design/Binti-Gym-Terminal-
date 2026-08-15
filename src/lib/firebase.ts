import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

// Use the standard Firestore client. Do not force a transport here; Firebase
// automatically selects the connection supported by the current browser/network.
export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
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

    // Authentication is optional under the current Firestore rules. Never make
    // a slow Auth request prevent the Firestore listeners from starting.
    const fallbackTimer = setTimeout(() => {
      console.warn('Firebase Auth timed out; continuing with Firestore access.');
      finish(null);
    }, 2500);

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
