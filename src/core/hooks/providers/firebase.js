/**
 * Firebase Firestore Provider
 * ─────────────────────────────────────────────────────────────
 * Menggunakan kredensial Firebase yang di-hardcode agar langsung
 * berfungsi saat dideploy ke Cloudflare Pages (remuk.id) tanpa
 * harus setup environment variables di panel dashboard.
 * ─────────────────────────────────────────────────────────────
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIQSMh2fPb-xfnwPj2FSOIetibha0dh3k",
  authDomain: "remuk-tools.firebaseapp.com",
  projectId: "remuk-tools",
  storageBucket: "remuk-tools.firebasestorage.app",
  messagingSenderId: "379630741629",
  appId: "1:379630741629:web:00625ad7ae859fc39ee914"
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
