import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDFLiw0xhfxKDFtuPLEe_-FH10rDqvn3Rc",
  authDomain: "tec-weekly-goals.firebaseapp.com",
  databaseURL: "https://tec-weekly-goals-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tec-weekly-goals",
  storageBucket: "tec-weekly-goals.appspot.com",
  messagingSenderId: "682881802889",
  appId: "1:682881802889:web:ce1760c069c1ad5bb01c58",
  measurementId: "G-HV41WSHDHX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app, "gs://tec-weekly-goals.appspot.com");

export { db, auth, storage };
