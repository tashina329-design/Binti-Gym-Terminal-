import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);

let authInitPromise: Promise<User | null> | null = null;

export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (authInitPromise) return authInitPromise;

  authInitPromise = new Promise<User | null>((resolve) => {
    let resolved = false;
    const finish = (user: User | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(fallbackTimer);
      resolve(user);
    };

    const fallbackTimer = setTimeout(() => {
      finish(auth.currentUser || null);
    }, 2000);

    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        finish(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          finish(cred.user);
        } catch (err) {
          console.warn('Firebase anonymous auth notice:', err);
          finish(null);
        }
      }
    });
  });

  return authInitPromise;
}

// Automatically ensure authenticated session on app initialization
ensureFirebaseAuth().then((user) => {
  if (user) {
    console.log('Firebase Auth initialized for terminal session uid:', user.uid);
  }
}).catch((err) => {
  console.warn('Firebase auth initialization warning:', err);
});





