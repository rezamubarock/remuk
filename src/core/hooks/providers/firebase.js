/**
 * Firebase Firestore Provider
 * ─────────────────────────────────────────────────────────────
 * Install: npm install firebase
 * Config : Isi FIREBASE_CONFIG di bawah dengan config project kamu
 * ─────────────────────────────────────────────────────────────
 */

// TODO: Ganti dengan config Firebase kamu
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let firestoreInstance = null;

const FirebaseService = {
  async init() {
    if (firestoreInstance) return firestoreInstance;

    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');

    const app = getApps().length === 0
      ? initializeApp(FIREBASE_CONFIG)
      : getApps()[0];

    firestoreInstance = {
      db: getFirestore(app),
    };

    return firestoreInstance;
  },
};

export default FirebaseService;
