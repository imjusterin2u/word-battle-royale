// ============================================================
// Word Battle Royale — game.js
// Ported from Apps Script backend (Code.gs)
// Sheets-specific calls are replaced with Firebase stubs.
// Search for "TODO: Firebase" to find each swap point.
// ============================================================

// ------------------------------------------------------------------
// Data helpers — previously read from Google Sheets tabs
// These now fall back to BUILTIN data by default.
// When you connect Firebase, replace the fallback arrays with
// Firestore reads from LCONFIG.COLLECTIONS.*
// ------------------------------------------------------------------

function getWordsForStep(step) {
  // TODO: Firebase — read from wbr_wordBank collection, filter by step
  return BUILTIN.wordBank
    .filter(w => String(w.step) === String(step))
    .map(w => w.word);
}

function getMeaningsMap() {
  // TODO: Firebase — read from wbr_meanings collection
  // Returns { word: meaning, ... }
  return {};
}

function getHighFrequencyForStep(step) {
  // TODO: Firebase — read from wbr_highFrequency collection, filter by step
  return BUILTIN.highFrequency
    .filter(r => String(r.step) === String(step))
    .map(r => r.word);
}

function getTilesForSteps(steps, customTilesCsv) {
  const set = new Set();
  (steps || []).forEach(s =>
    (BUILTIN.graphemesByStep[s] || []).forEach(g => set.add(g))
  );
  if (customTilesCsv) {
    String(customTilesCsv).split(',').map(s => s.trim()).filter(Boolean).forEach(g => set.add(g));
  }
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(ch => set.add(ch));
  return Array.from(set);
}

// ------------------------------------------------------------------
// Room management — previously written to WBR_Rooms sheet
// ------------------------------------------------------------------

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function createRoom(teacher, mode, step, customTilesCsv) {
  const roomId = generateRoomId();
  const room = {
    roomId,
    teacher:     teacher || 'Teacher',
    mode:        mode || 'Lesson',
    step:        step || LCONFIG.DEFAULT_STEP,
    customTiles: customTilesCsv || '',
    phase:       'INIT',
    result:      'Created',
    notes:       'Room created',
    timestamp:   new Date().toISOString(),
    history:     [{ evt: 'createRoom', mode: mode || 'Lesson', step: step || LCONFIG.DEFAULT_STEP, ts: new Date().toISOString() }],
    // Battle state
    players: {},
  };

  // TODO: Firebase — await db.collection('wbr_rooms').doc(roomId).set(room);
  // For now, store in memory (single-device / lesson mode works fine)
  _rooms[roomId] = room;

  return roomId;
}

async function fetchLessonPayload(roomId, params) {
  const step  = (params && params.step) ? params.step : LCONFIG.DEFAULT_STEP;
  const words    = getWordsForStep(step);
  const meanings = getMeaningsMap();
  const hf       = getHighFrequencyForStep(step);
  const tiles    = getTilesForSteps([step, ...(params.reviewSteps || [])], params.customTilesCsv || '');

  appendHistory(roomId, { evt: 'fetchLessonPayload', step, counts: { words: words.length, hf: hf.length, tiles: tiles.length } });

  return { step, words, meanings, highFrequency: hf, tiles, config: LCONFIG };
}

// ------------------------------------------------------------------
// Phase logging — previously written as rows to WBR_Rooms sheet
// ------------------------------------------------------------------

function appendHistory(roomId, delta) {
  // TODO: Firebase — arrayUnion into the room document's history field
  const room = _rooms[roomId];
  if (!room) return;
  room.history = room.history || [];
  room.history.push(Object.assign({ ts: new Date().toISOString() }, delta));
}

function phaseQuickDrillLog(roomId, grapheme, correct) {
  appendHistory(roomId, { phase: 'QuickDrill', grapheme, correct: !!correct });
  return { ok: true };
}

function phaseWordReadingLog(roomId, word, recognizedText) {
  appendHistory(roomId, { phase: 'WordReading', word, recognizedText });
  return { ok: true };
}

function phaseHFLog(roomId, word, correct) {
  appendHistory(roomId, { phase: 'HighFrequency', word, correct: !!correct });
  return { ok: true };
}

function phaseEncodingLog(roomId, promptWord, studentSpelling, mode) {
  const pass = String(promptWord).toLowerCase() === String(studentSpelling).toLowerCase();
  appendHistory(roomId, { phase: 'Encoding', promptWord, studentSpelling, mode: mode || 'tiles', pass });
  return { ok: true, pass };
}

function phaseDictationLog(roomId, promptWord, studentTyped) {
  const pass = String(promptWord).toLowerCase() === String(studentTyped).toLowerCase();
  appendHistory(roomId, { phase: 'Dictation', promptWord, studentTyped, pass });
  return { ok: true, pass };
}

function phaseFluencyStartLog(roomId, passageId, text, targetSeconds) {
  appendHistory(roomId, {
    phase: 'Fluency', evt: 'start',
    passageId: passageId || 'passage',
    targetSeconds: Number(targetSeconds) || 60,
    length: String(text || '').split(/\s+/).filter(Boolean).length,
  });
  return { ok: true };
}

function phaseFluencyFinishLog(roomId, passageId, wordsRead, seconds, errors) {
  const secs = Math.max(1, Number(seconds) || 60);
  const wr   = Math.max(0, Number(wordsRead) || 0);
  const err  = Math.max(0, Number(errors) || 0);
  const wcpm = Math.round((wr - err) * (60 / secs));
  appendHistory(roomId, { phase: 'Fluency', evt: 'finish', passageId: passageId || 'passage', wordsRead: wr, seconds: secs, errors: err, wcpm });
  return { ok: true, wcpm };
}

// ------------------------------------------------------------------
// Session summary — previously written to WBR_Summaries sheet
// ------------------------------------------------------------------

async function saveSummary(roomId, teacher, step, summaryData) {
  const summary = Object.assign({
    timestamp: new Date().toISOString(),
    roomId, teacher, step,
  }, summaryData);

  // TODO: Firebase — await db.collection('wbr_summaries').add(summary);
  _summaries.push(summary);
  return { ok: true };
}

// ------------------------------------------------------------------
// Student profiles — previously stored in WBR_Profiles sheet
// ------------------------------------------------------------------

async function saveProfile(studentName, step, reviewStepsCSV, customTiles, syllables) {
  const profile = {
    student:       studentName,
    step,
    reviewStepsCSV: reviewStepsCSV || '',
    customTiles:   customTiles || '',
    syllables:     syllables || '',
    updated:       new Date().toISOString(),
  };

  // TODO: Firebase — upsert by student name
  _profiles[studentName] = profile;
  return { ok: true };
}

async function getProfile(studentName) {
  // TODO: Firebase — read from wbr_profiles
  return _profiles[studentName] || null;
}

// ------------------------------------------------------------------
// Battle / multiplayer state helpers
// ------------------------------------------------------------------

function battleResolve(roomId) {
  const room = _rooms[roomId];
  if (!room) return null;

  const players = Object.values(room.players || {});
  if (players.length < 2) return null;

  const [p1, p2] = players;
  const diff = p1.pts - p2.pts;

  if (diff > 0) {
    // p1 wins — take soldiers from p2
    const stolen = Math.min(Math.ceil(diff / 10), p2.army);
    p1.army += stolen;
    p2.army = Math.max(0, p2.army - stolen);
    p1.coins += stolen * 5;
  } else if (diff < 0) {
    const stolen = Math.min(Math.ceil(Math.abs(diff) / 10), p1.army);
    p2.army += stolen;
    p1.army = Math.max(0, p1.army - stolen);
    p2.coins += stolen * 5;
  }

  // Reset round points
  players.forEach(p => { p.pts = 0; });

  appendHistory(roomId, { evt: 'battleResolve', armies: players.map(p => ({ id: p.id, army: p.army, coins: p.coins })) });
  return room.players;
}

// ------------------------------------------------------------------
// In-memory store (replace with Firebase when ready)
// ------------------------------------------------------------------
const _rooms    = {};
const _profiles = {};
const _summaries = [];
