// ============================================================
// Word Battle Royale — firebase.js
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJQuEIqEloRkG2fxduWkzOwU2iIenpX90",
  authDomain: "wordbattleroyale-76f13.firebaseapp.com",
  projectId: "wordbattleroyale-76f13",
  storageBucket: "wordbattleroyale-76f13.firebasestorage.app",
  messagingSenderId: "709168255102",
  appId: "1:709168255102:web:e4224baa5038eb39eb882f"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Room functions ────────────────────────────────────────

async function fbCreateRoom(roomId, roomData) {
  await setDoc(doc(db, "wbr_rooms", roomId), {
    ...roomData,
    timestamp: serverTimestamp(),
  });
}

async function fbGetRoom(roomId) {
  const snap = await getDoc(doc(db, "wbr_rooms", roomId));
  return snap.exists() ? snap.data() : null;
}

async function fbAppendHistory(roomId, delta) {
  await updateDoc(doc(db, "wbr_rooms", roomId), {
    history: arrayUnion({ ...delta, ts: new Date().toISOString() }),
  });
}

// Listen for real-time opponent updates
function fbWatchRoom(roomId, callback) {
  return onSnapshot(doc(db, "wbr_rooms", roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ── Summary & profiles ────────────────────────────────────

async function fbSaveSummary(summaryData) {
  await addDoc(collection(db, "wbr_summaries"), {
    ...summaryData,
    timestamp: serverTimestamp(),
  });
}

async function fbSaveProfile(studentName, profileData) {
  await setDoc(doc(db, "wbr_profiles", studentName), {
    ...profileData,
    updated: serverTimestamp(),
  });
}

async function fbGetProfile(studentName) {
  const snap = await getDoc(doc(db, "wbr_profiles", studentName));
  return snap.exists() ? snap.data() : null;
}

// ── Export to window so game.js can use them ──────────────
window.fb = {
  createRoom:    fbCreateRoom,
  getRoom:       fbGetRoom,
  appendHistory: fbAppendHistory,
  watchRoom:     fbWatchRoom,
  saveSummary:   fbSaveSummary,
  saveProfile:   fbSaveProfile,
  getProfile:    fbGetProfile,
};

console.log("Firebase connected — project: wordbattleroyale-76f13");
