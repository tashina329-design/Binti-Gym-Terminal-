import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Support both static configuration and Vercel/Vite environment variables
const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : ({} as any);

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBZSZqX6mDucE2pAeSATjxoPF3Lrw1K0iE',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0329117938.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0329117938',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0329117938.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '368231596957',
  appId: env.VITE_FIREBASE_APP_ID || '1:368231596957:web:22393ebc9b7ffb85a1e574',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-remixremixstaffp-b8f5b69f-e55f-4e3e-ba5c-babddac50c2d',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const rawDbId = firebaseConfig.firestoreDatabaseId;
const databaseId = rawDbId && rawDbId !== '(default)' && rawDbId !== 'default' ? rawDbId : undefined;

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

    // 2-second timeout to prevent any blockage on third-party hosts or restricted domains
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
        } catch (err: any) {
          // Non-fatal warning on unauthorized domains like vercel.app
          console.warn('Firebase anonymous auth status (Firestore continues unaffected):', err?.message || err);
          finish(null);
        }
      }
    });
  });

  return authInitPromise;
}

// Automatically ensure authenticated session on app initialization
ensureFirebaseAuth().catch((err) => {
  console.warn('Firebase auth initialization warning:', err);
});






