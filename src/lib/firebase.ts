import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyBo1aTKsti_LH1FlwIltjPXVjsF0fCG_Kw",
  authDomain: "nyra-os-609c4.firebaseapp.com",
  projectId: "nyra-os-609c4",
  storageBucket: "nyra-os-609c4.firebasestorage.app",
  messagingSenderId: "71636728129",
  appId: "1:71636728129:web:18db34551712d3d12749c0",
  measurementId: "G-5KXQ98XE3R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);


