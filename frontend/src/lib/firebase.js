import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if we have the required config
let app = null;
let auth = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log('✅ Firebase initialized successfully');
} else {
  console.warn('⚠️ Firebase not initialized - missing environment variables');
  console.warn('Please set VITE_FB_API_KEY, VITE_FB_AUTH_DOMAIN, VITE_FB_PROJECT_ID, and VITE_FB_APP_ID');
}

// Custom verification page setup:
// To use the custom /verified page instead of Firebase's default page:
// 1. Go to Firebase Console → Authentication → Templates
// 2. Edit the "Email address verification" template
// 3. Set the action URL to: https://yourdomain.com/verified
// 4. This will redirect users to your custom verification success page

export { app, auth };
