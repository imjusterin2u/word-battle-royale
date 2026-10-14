// ============================================================
// Word Battle Royale — firebase.js
// Includes: Firestore, Firebase Storage, Plan save/load
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, updateDoc, deleteDoc, arrayUnion, serverTimestamp, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);

// ── Image upload to Firebase Storage ─────────────────────
async function fbUploadImage(file, path) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ── Room functions ────────────────────────────────────────
async function fbCreateRoom(roomId, roomData) {
  await setDoc(doc(db, "wbr_rooms", roomId), {
    ...roomData, timestamp: serverTimestamp(),
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

function fbWatchRoom(roomId, callback) {
  return onSnapshot(doc(db, "wbr_rooms", roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ── Profiles ──────────────────────────────────────────────
async function fbSaveProfile(studentName, profileData) {
  await setDoc(doc(db, "wbr_profiles", studentName), {
    ...profileData, updated: serverTimestamp(),
  });
}

async function fbGetProfile(studentName) {
  const snap = await getDoc(doc(db, "wbr_profiles", studentName));
  return snap.exists() ? snap.data() : null;
}

// ── Lesson Plans ──────────────────────────────────────────

// Save a plan (lesson or template)
async function fbSavePlan(planData, existingId) {
  // Upload any images first
  if (planData._srImageFile) {
    const path = `lesson-images/${Date.now()}_sr_${planData._srImageFile.name}`;
    planData.srImageUrl = await fbUploadImage(planData._srImageFile, path);
    delete planData._srImageFile;
  }
  if (planData._pImageFile) {
    const path = `lesson-images/${Date.now()}_passage_${planData._pImageFile.name}`;
    planData.pImageUrl = await fbUploadImage(planData._pImageFile, path);
    delete planData._pImageFile;
  }

  // Update in place when an existing plan id is given, otherwise create new
  if (existingId) {
    await setDoc(doc(db, "wbr_plans", existingId), {
      ...planData,
      savedAt: serverTimestamp(),
    });
    return existingId;
  }
  const docRef = await addDoc(collection(db, "wbr_plans"), {
    ...planData,
    savedAt: serverTimestamp(),
  });
  return docRef.id;
}

// Update an existing plan (e.g. toggle star)
async function fbUpdatePlan(planId, updates) {
  await updateDoc(doc(db, "wbr_plans", planId), updates);
}

// Newest first. Sorting here instead of in the query avoids
// Firestore's composite-index requirement.
function sortBySaved(plans) {
  const t = p => (p.savedAt && p.savedAt.toMillis) ? p.savedAt.toMillis() : 0;
  return plans.sort((a, b) => t(b) - t(a));
}

// Load plans by substep (for picker)
async function fbGetPlansBySubstep(substep) {
  const q = query(
    collection(db, "wbr_plans"),
    where("substep", "==", substep)
  );
  const snap = await getDocs(q);
  return sortBySaved(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

// Load all templates
async function fbGetTemplates() {
  const q = query(
    collection(db, "wbr_plans"),
    where("isTemplate", "==", true)
  );
  const snap = await getDocs(q);
  return sortBySaved(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

// Load recent plans for a student
async function fbGetStudentPlans(studentName) {
  const q = query(
    collection(db, "wbr_plans"),
    where("student", "==", studentName)
  );
  const snap = await getDocs(q);
  return sortBySaved(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

// Delete a plan permanently
async function fbDeletePlan(planId) {
  await deleteDoc(doc(db, "wbr_plans", planId));
}

// Load a single plan by ID
async function fbGetPlan(planId) {
  const snap = await getDoc(doc(db, "wbr_plans", planId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Summary ───────────────────────────────────────────────
async function fbSaveSummary(summaryData) {
  await addDoc(collection(db, "wbr_summaries"), {
    ...summaryData, timestamp: serverTimestamp(),
  });
}

// ── Export to window ──────────────────────────────────────
window.fb = {
  createRoom:       fbCreateRoom,
  getRoom:          fbGetRoom,
  appendHistory:    fbAppendHistory,
  watchRoom:        fbWatchRoom,
  saveProfile:      fbSaveProfile,
  getProfile:       fbGetProfile,
  saveSummary:      fbSaveSummary,
  savePlan:         fbSavePlan,
  updatePlan:       fbUpdatePlan,
  getPlansBySubstep:fbGetPlansBySubstep,
  getTemplates:     fbGetTemplates,
  getStudentPlans:  fbGetStudentPlans,
  getPlan:          fbGetPlan,
  deletePlan:       fbDeletePlan,
  uploadImage:      fbUploadImage,
};

console.log("Firebase connected — project: wordbattleroyale-76f13");
