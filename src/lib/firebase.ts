import { initializeApp } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable offline IndexedDB persistence safely for multi-tab operations
if (typeof window !== 'undefined') {
  if (typeof enableMultiTabIndexedDbPersistence === 'function') {
    enableMultiTabIndexedDbPersistence(db).catch(() => {
      enableIndexedDbPersistence(db).catch(() => {});
    });
  } else {
    enableIndexedDbPersistence(db).catch(() => {});
  }
}


