// ============================================================
// Word Battle Royale — ui.js
// Frontend logic ported from WBR-Index <script> block
// ============================================================

// ── DOM refs ──────────────────────────────────────────────
const menuEl   = document.getElementById('menu');
const gameEl   = document.getElementById('game');
const wrapEl   = document.getElementById('wrap');

const nameEl   = document.getElementById('name');
const stepEl   = document.getElementById('step');
const customEl = document.getElementById('customTiles');

const ridEl    = document.getElementById('rid');
const rndEl    = document.getElementById('rnd');
const statusEl = document.getElementById('gstatus');
const promptEl = document.getElementById('prompt');
const bannerEl = document.getElementById('banner');

const tileUIEl  = document.getElementById('tileUI');
const monoWrap  = document.getElementById('monoWrap');
const syllWrap  = document.getElementById('syllWrap');
const spellBox  = document.getElementById('spellBox');
const optionsEl = document.getElementById('options');

const tileTray  = document.getElementById('tileTray');
const dropZone  = document.getElementById('dropZone');
const syllTray  = document.getElementById('syllTray');
const syllGrid  = document.getElementById('syllGrid');

const prefixRow  = document.getElementById('prefixRow');
const suffixRow  = document.getElementById('suffixRow');
const prefixChip = document.getElementById('prefixChip');
const suffixChip = document.getElementById('suffixChip');

const tileSubmit = document.getElementById('tileSubmit');
const tileClear  = document.getElementById('tileClear');
const spellInput = document.getElementById('spellInput');
const spellBtn   = document.getElementById('spellBtn');
const wrapBtn    = document.getElementById('wrapBtn');
const resetBtn   = document.getElementById('resetBtn');
const backBtn    = document.getElementById('backBtn');
const startBtn   = document.getElementById('startBtn');
const battleBtn  = document.getElementById('battleBtn');

const buySoldier = document.getElementById('buySoldier');
const buyKnight  = document.getElementById('buyKnight');
const attackBtn  = document.getElementById('attackBtn');
const shopMsg    = document.getElementById('shopMsg');

const wordlistBox = document.getElementById('wordlistBox');
const wordCountEl = document.getElementById('wordCount');

const p1PtsEl   = document.getElementById('p1Pts');
const p1CoinsEl = document.getElementById('p1Coins');
const p1ArmyEl  = document.getElementById('p1Army');
const p2PtsEl   = document.getElementById('p2Pts');
const p2CoinsEl = document.getElementById('p2Coins');
const p2ArmyEl  = document.getElementById('p2Army');

// ── App state ─────────────────────────────────────────────
let state = {
  roomId:    null,
  payload:   null,
  round:     1,
  maxRounds: 10,
  phase:     null,       // 'hf' | 'encoding' | 'dictation' | 'reading'
  wordQueue: [],
  currentWord: null,
  p1: { pts: 0, coins: 100, army: 10 },
  // p2 is remote in multiplayer; local-only for now
};

// ── Init ──────────────────────────────────────────────────
stepEl.addEventListener('change', refreshWordList);
refreshWordList();

startBtn.addEventListener('click', async () => {
  const name = nameEl.value.trim() || 'Teacher';
  const step = stepEl.value;
  const tiles = customEl.value.trim();

  state.roomId = await createRoom(name, 'Lesson', step, tiles);
  state.payload = await fetchLessonPayload(state.roomId, {
    step,
    customTilesCsv: tiles,
    reviewSteps: [],
  });

  ridEl.textContent = state.roomId;
  state.round = 1;
  rndEl.textContent = state.round;
  Object.assign(state.p1, { pts: 0, coins: 100, army: 10 });
  updateScoreboard();

  state.wordQueue = shuffle([...state.payload.words]);
  showSection(gameEl);
  nextRound();
});

battleBtn.addEventListener('click', () => {
  alert('Battle Mode — coming soon! Start with Lesson Mode to test the word challenges.');
});

// ── Word list preview ──────────────────────────────────────
function refreshWordList() {
  const step = stepEl.value;
  const words = getWordsForStep(step);
  wordlistBox.innerHTML = words.map(w =>
    `<span class="pill">${w}</span>`
  ).join('');
  wordCountEl.textContent = words.length + ' words';
}

// ── Game flow ──────────────────────────────────────────────
function nextRound() {
  if (state.round > state.maxRounds) { endGame(); return; }

  rndEl.textContent = state.round;
  hideBanner();
  optionsEl.innerHTML = '';
  tileUIEl.style.display = 'none';
  spellBox.style.display = 'none';

  if (state.wordQueue.length === 0) {
    state.wordQueue = shuffle([...state.payload.words]);
  }

  state.currentWord = state.wordQueue.pop();
  if (!state.currentWord) { endGame(); return; }

  // Alternate phases: encoding → dictation → HF → encoding …
  const phases = ['encoding', 'hf', 'dictation'];
  state.phase = phases[(state.round - 1) % phases.length];

  switch (state.phase) {
    case 'encoding':   startEncoding();   break;
    case 'hf':         startHFPhase();    break;
    case 'dictation':  startDictation();  break;
  }
}

// ── Encoding (tile build) ──────────────────────────────────
function startEncoding() {
  statusEl.textContent = 'ENCODING';
  promptEl.textContent = `Build the word: ${state.currentWord}`;
  showTileUI(state.currentWord, state.payload.tiles);
}

function showTileUI(targetWord, tiles) {
  const syllables = splitSyllables(targetWord);

  tileUIEl.style.display = '';
  prefixRow.style.display = 'none';
  suffixRow.style.display = 'none';

  if (syllables.length > 1) {
    monoWrap.style.display = 'none';
    syllWrap.style.display = '';
    buildSyllGrid(syllables, tiles);
  } else {
    syllWrap.style.display = 'none';
    monoWrap.style.display = '';
    buildTileMonoTray(tiles, dropZone, tileTray);
  }
}

function buildTileMonoTray(tiles, drop, tray) {
  tray.innerHTML = '';
  drop.innerHTML = '<span class="hint">Drag tiles here (left→right)</span>';

  shuffle([...tiles]).forEach(t => {
    const el = makeTile(t);
    makeDraggable(el, tray, drop);
    tray.appendChild(el);
  });

  enableDropZone(drop, tray);
}

function buildSyllGrid(syllables, tiles) {
  syllTray.innerHTML = '';
  syllGrid.innerHTML = '';

  syllables.forEach((_, i) => {
    const col = document.createElement('div');
    col.className = 'syllCol';
    const lbl = document.createElement('div');
    lbl.className = 'syllLabel';
    lbl.textContent = `Syl. ${i + 1}`;
    const drop = document.createElement('div');
    drop.className = 'syllDrop';
    drop.dataset.syl = i;
    col.appendChild(lbl);
    col.appendChild(drop);
    syllGrid.appendChild(col);
    enableDropZone(drop, syllTray);
  });

  shuffle([...tiles]).forEach(t => {
    const el = makeTile(t);
    syllTray.appendChild(el);
    const drops = syllGrid.querySelectorAll('.syllDrop');
    makeDraggable(el, syllTray, ...drops);
  });
}

tileSubmit.addEventListener('click', () => {
  const built = getBuiltWord();
  const pass  = built.toLowerCase() === state.currentWord.toLowerCase();
  phaseEncodingLog(state.roomId, state.currentWord, built, 'tiles');
  awardPoints(pass ? 15 : 0);
  showBanner(pass, built, state.currentWord);
  setTimeout(() => { state.round++; nextRound(); }, 1500);
});

tileClear.addEventListener('click', () => {
  // Return all tiles from drop zones back to the tray
  const allDrops = [dropZone, ...syllGrid.querySelectorAll('.syllDrop')];
  allDrops.forEach(dz => {
    [...dz.querySelectorAll('.tile')].forEach(t => {
      const home = t.dataset.tray === 'syll' ? syllTray : tileTray;
      home.appendChild(t);
    });
    dz.innerHTML = dz === dropZone ? '<span class="hint">Drag tiles here (left→right)</span>' : '';
  });
});

// ── Dictation ─────────────────────────────────────────────
function startDictation() {
  statusEl.textContent = 'DICTATION';
  promptEl.textContent = `Spell the word (listen carefully): ${state.currentWord}`;
  spellBox.style.display = '';
  spellInput.value = '';
  spellInput.focus();
}

spellBtn.addEventListener('click', submitDictation);
spellInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitDictation(); });

function submitDictation() {
  const typed = spellInput.value.trim();
  const pass  = typed.toLowerCase() === state.currentWord.toLowerCase();
  phaseDictationLog(state.roomId, state.currentWord, typed);
  awardPoints(pass ? 10 : 0);
  showBanner(pass, typed, state.currentWord);
  setTimeout(() => { state.round++; nextRound(); }, 1500);
}

// ── High-frequency ────────────────────────────────────────
function startHFPhase() {
  const hfWords = state.payload.highFrequency;
  if (!hfWords || hfWords.length === 0) { state.round++; nextRound(); return; }

  statusEl.textContent = 'HIGH FREQUENCY';
  const word    = hfWords[Math.floor(Math.random() * hfWords.length)];
  state.currentWord = word;
  promptEl.textContent = `Which is the word "${word}"?`;

  // Build options: correct + 3 distractors from other HF words or word bank
  const pool       = [...(state.payload.words || []), ...(hfWords.filter(w => w !== word))];
  const distractors = shuffle(pool.filter(w => w !== word)).slice(0, 3);
  const options     = shuffle([word, ...distractors]);

  optionsEl.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      const pass = opt === word;
      phaseHFLog(state.roomId, word, pass);
      awardPoints(pass ? 10 : 0);
      btn.classList.add(pass ? 'correct' : 'wrong');
      setTimeout(() => { optionsEl.innerHTML = ''; state.round++; nextRound(); }, 1000);
    });
    optionsEl.appendChild(btn);
  });
}

// ── Shop actions ──────────────────────────────────────────
buySoldier.addEventListener('click', () => {
  if (state.p1.coins < 20) { flashMsg(shopMsg, 'Not enough coins!'); return; }
  state.p1.coins -= 20;
  state.p1.army  += 1;
  updateScoreboard();
  flashMsg(shopMsg, '+1 soldier 🪖');
});

buyKnight.addEventListener('click', () => {
  if (state.p1.coins < 50) { flashMsg(shopMsg, 'Not enough coins!'); return; }
  state.p1.coins -= 50;
  state.p1.army  += 3;
  updateScoreboard();
  flashMsg(shopMsg, '+3 knights ⚔️');
});

attackBtn.addEventListener('click', () => {
  if (state.p1.coins < 40) { flashMsg(shopMsg, 'Not enough coins!'); return; }
  state.p1.coins -= 40;
  updateScoreboard();
  flashMsg(shopMsg, '💥 Attack launched!');
  // TODO: In multiplayer, send attack event via Firebase
});

// ── Scoreboard ────────────────────────────────────────────
function updateScoreboard() {
  p1PtsEl.textContent   = `Pts: ${state.p1.pts}`;
  p1CoinsEl.textContent = `Coins: ${state.p1.coins}`;
  p1ArmyEl.textContent  = `Army: ${state.p1.army}`;
}

function awardPoints(pts) {
  if (pts <= 0) return;
  state.p1.pts   += pts;
  state.p1.coins += Math.floor(pts / 3);
  updateScoreboard();
}

// ── Wrap-up ───────────────────────────────────────────────
wrapBtn.addEventListener('click', showWrapUp);
backBtn.addEventListener('click', () => { showSection(gameEl); });
resetBtn.addEventListener('click', () => { showSection(menuEl); });

function showWrapUp() {
  const history = (_rooms[state.roomId] || {}).history || [];
  const enc     = history.filter(h => h.phase === 'Encoding');
  const dict    = history.filter(h => h.phase === 'Dictation');
  const hf      = history.filter(h => h.phase === 'HighFrequency');

  document.getElementById('wrapStats').innerHTML =
    `<strong>Room:</strong> ${state.roomId} &nbsp;|&nbsp; <strong>Step:</strong> ${stepEl.value} &nbsp;|&nbsp; <strong>Rounds:</strong> ${state.round - 1}`;

  const rows = [
    ...enc.map(h  => ({ Phase: 'Encoding',      Word: h.promptWord,   Result: h.pass ? '✓' : '✗', Typed: h.studentSpelling })),
    ...dict.map(h => ({ Phase: 'Dictation',     Word: h.promptWord,   Result: h.pass ? '✓' : '✗', Typed: h.studentTyped    })),
    ...hf.map(h  => ({ Phase: 'High Freq.',     Word: h.word,         Result: h.correct ? '✓' : '✗', Typed: '—'            })),
  ];

  const wrapTable = document.getElementById('wrapTable');
  if (rows.length === 0) { wrapTable.innerHTML = '<p style="color:var(--muted)">No data yet.</p>'; }
  else {
    wrapTable.innerHTML = `<table>
      <thead><tr><th>Phase</th><th>Word</th><th>Result</th><th>Student answered</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.Phase}</td><td>${r.Word}</td><td>${r.Result}</td><td>${r.Typed}</td></tr>`).join('')}</tbody>
    </table>`;
  }

  showSection(wrapEl);
}

function endGame() {
  showWrapUp();
}

// ── Banner ─────────────────────────────────────────────────
function showBanner(pass, typed, correct) {
  bannerEl.style.display = '';
  bannerEl.className     = 'banner ' + (pass ? 'correct' : 'wrong');
  bannerEl.textContent   = pass
    ? `✓ Correct! "${correct}"`
    : `✗ "${typed}" — correct answer: "${correct}"`;
}

function hideBanner() {
  bannerEl.style.display = 'none';
  bannerEl.textContent   = '';
}

// ── Tile drag & drop ──────────────────────────────────────
let dragEl = null;

function makeTile(text) {
  const el = document.createElement('div');
  el.className   = 'tile' + (text.length > 1 ? ' digraph' : '');
  el.textContent = text;
  el.draggable   = true;
  return el;
}

function makeDraggable(el, homeTray, ...dropTargets) {
  el.dataset.tray = homeTray === syllTray ? 'syll' : 'mono';

  el.addEventListener('dragstart', e => {
    dragEl = el;
    el.style.opacity = '.4';
    e.dataTransfer.effectAllowed = 'move';
  });

  el.addEventListener('dragend', () => {
    el.style.opacity = '';
    dragEl = null;
    document.querySelectorAll('.dropZone, .syllDrop').forEach(dz => dz.classList.remove('over'));
  });

  // Touch support (iPad)
  el.addEventListener('touchstart', e => { dragEl = el; }, { passive: true });
  el.addEventListener('touchend', e => {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const drop = target && target.closest('.dropZone, .syllDrop');
    if (drop) drop.appendChild(el);
    dragEl = null;
  });
}

function enableDropZone(zone, homeTray) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('over');
    if (dragEl) {
      // Remove placeholder hint if present
      zone.querySelectorAll('.hint').forEach(h => h.remove());
      zone.appendChild(dragEl);
    }
  });
  // Click to return tile to tray
  zone.addEventListener('click', e => {
    if (e.target.classList.contains('tile')) {
      homeTray.appendChild(e.target);
      if (zone.querySelectorAll('.tile').length === 0 && zone.classList.contains('dropZone')) {
        zone.innerHTML = '<span class="hint">Drag tiles here (left→right)</span>';
      }
    }
  });
}

function getBuiltWord() {
  const mono = [...dropZone.querySelectorAll('.tile')].map(t => t.textContent).join('');
  if (mono) return mono;
  const syllParts = [...syllGrid.querySelectorAll('.syllDrop')]
    .map(dz => [...dz.querySelectorAll('.tile')].map(t => t.textContent).join(''));
  return syllParts.join('');
}

// ── Utilities ─────────────────────────────────────────────
function showSection(el) {
  [menuEl, gameEl, wrapEl].forEach(s => s.style.display = 'none');
  el.style.display = '';
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function splitSyllables(word) {
  // Simple heuristic: split on consonant clusters between vowels
  // For production, replace with a proper Wilson syllabification function
  if (word.length <= 4) return [word];
  const mid = Math.floor(word.length / 2);
  return [word.slice(0, mid), word.slice(mid)];
}

function flashMsg(el, msg) {
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 2000);
}
