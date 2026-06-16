import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCawNBZMV3mV_s-ZgBfEkNzJlh6G74k9xs",
  authDomain: "ayush-service-center.firebaseapp.com",
  projectId: "ayush-service-center",
  storageBucket: "ayush-service-center.firebasestorage.app",
  messagingSenderId: "720883452589",
  appId: "1:720883452589:web:c0ebb799460cb06654d424"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);