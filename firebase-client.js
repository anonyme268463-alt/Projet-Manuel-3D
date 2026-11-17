/*
 * GUIDE 3D — Client Firebase partagé
 * Tous les modules importent cette instance : une seule application, Auth et Firestore.
 * Le transport long-polling auto-détecté contourne certains problèmes WebChannel/HTTP3.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyCG9nmgw8xm83xD6BlbXLyS8fCd41olX6s",
  authDomain: "guide-3d.firebaseapp.com",
  projectId: "guide-3d",
  storageBucket: "guide-3d.firebasestorage.app",
  messagingSenderId: "714446657255",
  appId: "1:714446657255:web:7ed8061d9baf056200b442",
  measurementId: "G-VJZ0W8ST2C"
});

export const app = getApps().length
  ? getApps().find(instance => instance.name === "[DEFAULT]") || getApps()[0]
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// initializeFirestore doit être appelé avant tout getFirestore(app).
// Tous les modules du site passent désormais par ce fichier.
let firestore;
try {
  firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
} catch (error) {
  // Si un autre module a déjà initialisé Firestore, réutiliser l'instance existante.
  if (error?.code === "failed-precondition" || error?.code === "already-initialized") {
    firestore = getFirestore(app);
  } else {
    throw error;
  }
}
export const db = firestore;

let secondaryApp;
let secondaryAuth;

export async function getAccountCreationAuth() {
  if (!secondaryApp) {
    const { initializeApp: init } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js");
    const { getAuth: authForApp } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
    const appName = "guide3d-account-creator";
    const existing = getApps().find(instance => instance.name === appName);
    secondaryApp = existing || init(firebaseConfig, appName);
    secondaryAuth = authForApp(secondaryApp);
  }
  return secondaryAuth;
}
