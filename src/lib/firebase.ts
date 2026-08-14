import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, Firestore } from 'firebase/firestore';
import configFile from '../../firebase-applet-config.json';

const hardcodedConfig = {
  projectId: "bubbly-origin-nv7sv",
  appId: "1:457746749974:web:0136c1f2067898b4897337",
  apiKey: "AIzaSyC497CCzVzCln1x4Qy0GeldWd3v-VergfI",
  authDomain: "bubbly-origin-nv7sv.firebaseapp.com",
  storageBucket: "bubbly-origin-nv7sv.firebasestorage.app",
  messagingSenderId: "457746749974",
  measurementId: "",
  oAuthClientId: "457746749974-q53thivbphmdfhc21krqdk97qmprdda4.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

export const firebaseConfig = (configFile && (configFile as any).projectId) ? configFile : hardcodedConfig;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreInstance: Firestore;

try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (err) {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache()
    });
  } catch (err2) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;



