import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Konfigurasi default (Fallback ke dummy key jika .env belum diisi)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalTesting12345",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0709914952",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://gen-lang-client-0709914952-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Inisialisasi Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Realtime Database & Auth
export const database = getDatabase(app);
export const auth = getAuth(app);