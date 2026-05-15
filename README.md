# Word Battle Royale — Web App

Ported from Google Apps Script (v5.2) to a standalone HTML/JS/CSS web app.

## File structure

```
wbr/
├── index.html        — Main UI (menu → game → wrap-up)
├── css/
│   └── style.css     — All styling
└── js/
    ├── config.js     — LCONFIG + BUILTIN data (steps, graphemes, word bank)
    ├── game.js       — Backend logic (rooms, phases, scoring, profiles)
    └── ui.js         — Frontend wiring (tile drag & drop, game flow, phases)
```

## Running locally

Just open `index.html` in a browser. No server needed for lesson mode.

On a Mac: double-click `index.html`, or run:
```
open index.html
```

## What works right now

- Lesson mode (single player / teacher-led)
- Step selection (1.3 → 3.1)
- Word bank preview on the menu screen
- Encoding phase (tile drag-and-drop, single and multisyllabic)
- Dictation phase (type the word)
- High-frequency word phase (multiple choice)
- Scoreboard (points, coins, army)
- Shop (buy soldiers, buy knights)
- Wrap-up / session summary table

## What still needs Firebase (multiplayer)

Every spot that needs Firebase is marked with `// TODO: Firebase` in game.js.
The in-memory fallbacks (`_rooms`, `_profiles`, `_summaries`) keep everything
working for single-player / lesson mode in the meantime.

### Steps to add Firebase

1. Go to https://console.firebase.google.com and create a project
2. Enable Firestore (start in test mode)
3. Add your Firebase config to a new file `js/firebase.js`:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // etc — copy from Firebase console
};

const app = initializeApp(firebaseConfig);
window.db  = getFirestore(app);
```

4. Add `<script type="module" src="js/firebase.js"></script>` before the other scripts in index.html

5. In game.js, replace the `_rooms` in-memory store with Firestore calls.
   Each `// TODO: Firebase` comment shows exactly what to replace.

### Key Firebase swap: real-time multiplayer

Replace the `createRoom` return with a Firestore listener:

```js
// In ui.js, after createRoom():
import { doc, onSnapshot } from "firebase-firestore";

onSnapshot(doc(db, 'wbr_rooms', state.roomId), (snap) => {
  const data = snap.data();
  if (!data) return;
  // Update opponent score, handle attacks, etc.
  p2PtsEl.textContent   = `Pts: ${data.players?.p2?.pts ?? 0}`;
  p2CoinsEl.textContent = `Coins: ${data.players?.p2?.coins ?? 100}`;
  p2ArmyEl.textContent  = `Army: ${data.players?.p2?.army ?? 10}`;
});
```

## Deploying to GitHub Pages (free hosting)

1. Create a GitHub account if you don't have one
2. Create a new repo (e.g. `word-battle-royale`)
3. Upload all files, keeping the folder structure
4. Go to Settings → Pages → Source: main branch / root
5. Your game will be live at `https://yourusername.github.io/word-battle-royale`

Students and teachers just visit that URL — no login, works on iPad and Mac.

## Adding more words

Edit `js/config.js` — add entries to `BUILTIN.wordBank`:

```js
{ step: '2.1', word: 'blank' },
{ step: '2.1', word: 'drink' },
```

Or once Firebase is connected, add words directly in the Firestore console
and they'll appear for all users immediately.
