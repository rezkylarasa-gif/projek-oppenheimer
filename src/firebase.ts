import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForRTDB123456789",
  projectId: "gen-lang-client-0709914952",
  databaseURL: "https://gen-lang-client-0709914952-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Realtime Database
export const database = getDatabase(app);

// Initialize Firebase Auth safely
let authInstance: Auth | null = null;
try {
  authInstance = getAuth(app);
} catch (e) {
  console.warn("Firebase Auth safely bypassed:", e);
}

export const auth = authInstance;
