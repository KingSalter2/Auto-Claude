import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmPAZszGYNKt1rIFOmgCx91jukDmIlP2Q",
  authDomain: "automate-sa-multi.firebaseapp.com",
  projectId: "automate-sa-multi",
  storageBucket: "automate-sa-multi.firebasestorage.app",
  messagingSenderId: "488769006903",
  appId: "1:488769006903:web:4a17c884b6ecb7e2c7feb2",
  measurementId: "G-BG6LHK5GQX",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);

export const firebaseDb = getFirestore(firebaseApp);
