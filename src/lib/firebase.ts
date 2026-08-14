import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

export const firebaseConfig = configFile;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

let firestoreInstance: Firestore;

try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    databaseId
  );
} catch (err) {
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        localCache: memoryLocalCache(),
      },
      databaseId
    );
  } catch (err2) {
    firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Verify connection to Firestore on initialization
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();




