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

// Shrink a photo/screenshot and turn it into text that can live inside the
// plan itself. Firebase Storage isn't set up for this project, so uploading
// there made Save Plan fail; a plan can hold up to ~1 MB, so each image is
// kept under ~300 KB.
async function fbImageToDataUrl(file, maxBytes = 300000) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Only pictures can be saved with a plan (PDFs can\'t). Take a screenshot of the page and upload that instead.');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That picture could not be opened.'));
      i.src = url;
    });
    let width = Math.min(1400, img.naturalWidth || 1400);
    let quality = 0.78;
    for (let tries = 0; tries < 12; tries++) {
      const height = Math.round(width * (img.naturalHeight / img.naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length * 0.75 <= maxBytes) return data;
      if (quality > 0.5) quality -= 0.1; else width = Math.round(width * 0.8);
    }
    throw new Error('That picture is too large to save, even after shrinking it.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Save a plan (lesson or template)
async function fbSavePlan(planData, existingId) {
  // Images are stored inside the plan (see fbImageToDataUrl)
  if (planData._srImageFile) {
    planData.srImageUrl = await fbImageToDataUrl(planData._srImageFile);
    delete planData._srImageFile;
  }
  if (planData._pImageFile) {
    planData.pImageUrl = await fbImageToDataUrl(planData._pImageFile);
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

// ── Battle rooms ──────────────────────────────────────────
// Create a battle room with a 4-character code. Returns false if
// that code is already in use by a recent room.
async function fbCreateBattle(code, data) {
  const r = doc(db, "wbr_rooms", code);
  const snap = await getDoc(r);
  if (snap.exists()) {
    const age = Date.now() - (snap.data().createdMs || 0);
    if (age < 12 * 3600 * 1000) return false;
  }
  await setDoc(r, JSON.parse(JSON.stringify(data)));
  return true;
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
  createBattle:     fbCreateBattle,
  imageToDataUrl:   fbImageToDataUrl,
  uploadImage:      fbUploadImage,
};

console.log("Firebase connected — project: wordbattleroyale-76f13");
