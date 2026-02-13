// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, query } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Firebase project config (same as cashFollowup)
const firebaseConfig = {
    apiKey: "AIzaSyCsNhNFl3kvPKPtyKasaDAF2Kv7vcbAiV8",
    authDomain: "cashfollowup.firebaseapp.com",
    projectId: "cashfollowup",
    storageBucket: "cashfollowup.firebasestorage.app",
    messagingSenderId: "297999980788",
    appId: "1:297999980788:web:ab609eae4a331feacb66a1",
    measurementId: "G-NTR66XSRLK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestoreDb = getFirestore(app);

// Expose on window for non-module scripts
window.firebaseAuth = auth;
window.firestoreDb = firestoreDb;

// Expose Firestore helper functions for non-module scripts (transfers.js)
window.firestoreFns = {
    collection: collection,
    addDoc: addDoc,
    onSnapshot: onSnapshot,
    deleteDoc: deleteDoc,
    doc: doc,
    updateDoc: updateDoc,
    serverTimestamp: serverTimestamp,
    query: query
};

console.log('Firebase initialized successfully!');
