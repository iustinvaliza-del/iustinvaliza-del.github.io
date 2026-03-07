/* ============================================
   Legacy Stewards — Firebase Configuration
   ============================================

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create a new project called "legacy-stewards"
   3. Enable Authentication > Email/Password provider
   4. Create a Firestore Database (production mode)
   5. Enable Storage
   6. Go to Project Settings > General > Your apps > Add web app
   7. Copy your config values below
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyDsGp_HgGeHiRIGz7GdYX4QBIMNBJWqd64",
    authDomain: "legacy-stewards.firebaseapp.com",
    projectId: "legacy-stewards",
    storageBucket: "legacy-stewards.firebasestorage.app",
    messagingSenderId: "194865951512",
    appId: "1:194865951512:web:ed3747c526f5233592246d",
    measurementId: "G-G838C9VZ24"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global references
const auth = firebase.auth();
const db = firebase.firestore();
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;

// Firestore settings
db.settings({ timestampsInSnapshots: true });
