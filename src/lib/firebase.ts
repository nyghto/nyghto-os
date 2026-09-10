import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCkssosPvRpETAVXycodS1ACh-liCmwhLY",
  authDomain: "nyghto.firebaseapp.com",
  projectId: "nyghto",
  storageBucket: "nyghto.firebasestorage.app",
  messagingSenderId: "479532192298",
  appId: "1:479532192298:web:5b7838e478da2d1c6c2953",
  measurementId: "G-TBDQNT1C1K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
