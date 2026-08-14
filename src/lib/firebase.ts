import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);

// Verify Firestore connection non-blockingly
(async () => {
  try {
    const testDoc = doc(db, 'gym', 'registry');
    await getDoc(testDoc);
    console.log('Firebase Firestore connected successfully to db:', databaseId || '(default)');
  } catch (error) {
    console.warn('Firebase connection check:', error);
  }
})();





