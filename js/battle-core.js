// ============================================================
// Word Battle Royale — battle-core.js
// Pure Battle Mode rules: word pools, question generators,
// round scoring and the BOT. No DOM and no Firebase here, so the
// same logic runs on every device and can be tested on its own.
// Needs BUILTIN and SOUND_CARDS from config.js.
// ============================================================
(function (global) {
  'use strict';

  // ── Economy (from the WBR v4.0 concept) ─────────────────────
  const ECON = {
    startCoins: 50, startArmy: 10,
    correctPts: 1, correctCoins: 10, correctArmy: 2,
    wrongCoins: 5,
    soldierCost: 20, soldierArmy: 1,
    knightCost: 50, knightArmy: 3,
    speedCoins: 30, speedArmy: 5, speedSteal: 15,
    attackCost: 40, defendCoins: 20, defendArmy: 3, attackCapture: 3,
  };

  const TIMING = {
    rounds: 8,
    speedEvery: 3,      // rounds 3 and 6 are Speed Battles (after every two normal rounds)
    normalSecs: 60,
    speedSecs: 20,
    attackSecs: 20,     // timer for a player hit by a Surprise Attack
    resultsSecs: 20,    // shop / results window between rounds
    graceSecs: 3,
  };

  // Step where each suffix is taught (concept gating for affix questions)
  const SUFFIX_STEP = {
    s: '1.6', es: '1.6', ed: '3.5', ing: '3.5', ive: '4.4',
    able: '6.1', en: '6.1', er: '6.1', est: '6.1', ish: '6.1', or: '6.1',
    y: '6.1', ful: '6.1', less: '6.1', ly: '6.1', ment: '6.1', ness: '6.1', ty: '6.1',
  };

  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

  // ── Small helpers ───────────────────────────────────────────
  const stepNum = s => parseFloat(s);
  const uniq = arr => Array.from(new Set(arr));
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const normWord = w => String(w || '').trim().toLowerCase();
  const isWord = w => /^[a-z]{2,}$/.test(w);

  // Split a teacher-typed box ("Helpful, Basement\nQuicksand") into words
  function parseWordBox(text) {
    return uniq(String(text || '')
      .split(/[\n,;]+/)
      .map(normWord)
      .filter(isWord));
  }

  function allSteps() {
    return Object.keys(BUILTIN.graphemesByStep).sort((a, b) => stepNum(a) - stepNum(b));
  }
  function stepsUpTo(step) {
    const n = stepNum(step);
    return allSteps().filter(s => stepNum(s) <= n);
  }

  // Graphemes that can appear as a contiguous chunk of a word
  function learnedGraphemes(step) {
    const set = new Set();
    stepsUpTo(step).forEach(s => (BUILTIN.graphemesByStep[s] || []).forEach(g => {
      const clean = String(g).replace(/^-/, '').toLowerCase();
      if (!clean || /[^a-z]/.test(clean)) return;   // skip a-e, n't, etc.
      set.add(clean);
    }));
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach(ch => set.add(ch));
    return set;
  }

  // Welded sounds / exceptions can sit anywhere in a word
  const WELDED = new Set(['1.4', '1.5', '2.1', '2.3', '4.4', '6.4']
    .flatMap(s => (BUILTIN.graphemesByStep[s] || []))
    .map(g => g.replace(/^-/, '')));

  const catOf = g => BUILTIN.tileCategories[g] || BUILTIN.tileCategories['-' + g] || '';

  // Break a word into Wilson tiles using only graphemes taught so far.
  // A prefix tile needs a real word (or Latin base) after it, a suffix tile
  // needs a real base before it, and a Latin/Greek base must follow a prefix.
  function segment(word, learned, allWords) {
    const known = allWords || new Set();
    const w = normWord(word);
    const multi = Array.from(learned).filter(g => g.length > 1).sort((a, b) => b.length - a.length);
    const out = [];
    let i = 0;
    while (i < w.length) {
      let pick = null;
      for (const g of multi) {
        if (!w.startsWith(g, i)) continue;
        const c = catOf(g);
        const rest = w.length - (i + g.length);
        if (WELDED.has(g)) { pick = g; break; }
        if (c === 'prefix') {
          if (!(i === 0 && rest >= 3)) continue;
          const after = w.slice(g.length);
          const baseAfter = multi.some(b => ['latin', 'greek'].includes(catOf(b)) && after.startsWith(b));
          if (!known.has(after) && !baseAfter && !hasSuffixedBase(after, known)) continue;
        }
        if (c === 'suffix') {
          if (!(rest === 0 && i >= 3)) continue;
          const base = w.slice(0, i);
          if (g === 'es' && !/(s|x|z|ch|sh)$/.test(base)) continue;
          if (!deriveBase(w, g, known) && !known.has(base) && !/[aeiouy]/.test(base.slice(1))) continue;
        }
        if ((c === 'latin' || c === 'greek') && (i === 0 || g.length >= w.length)) continue;
        pick = g; break;
      }
      if (!pick) pick = w[i];
      out.push({ g: pick, c: tileColor(pick, i, w) });
      i += pick.length;
    }
    return out;
  }

  function hasSuffixedBase(rest, known) {
    return Object.keys(SUFFIX_STEP).some(sfx => {
      const d = deriveBase(rest, sfx, known);
      return d && d.base.length >= 3;
    });
  }

  // Colour class for a tile, matching the teacher console
  function tileColor(g, index, word) {
    if (g.length === 1) return VOWELS.has(g) ? 'vowel' : 'consonant';
    const c = catOf(g);
    const atEnd = word ? index + g.length === word.length && index >= 3 : false;
    if (c === 'suffix' && atEnd) return 'suffix';
    if (WELDED.has(g)) return (c === 'consonant') ? 'consonant' : 'welded';
    return c || 'welded';
  }

  // ── Syllable division (Wilson Steps 3–6) ────────────────────
  // Order: split off a taught prefix, split off a taught suffix, then divide
  // the rest between vowel sounds. Digraphs, ck, tch, qu and x stay together;
  // VCCV → VC|CV; VCCCV keeps a blend with the next syllable; VCV is closed
  // (VC|V) before Step 5 and open (V|CV) from Step 5 on.
  const DIGRAPHS = ['tch', 'ch', 'sh', 'th', 'wh', 'ck', 'ph', 'qu'];
  const BLENDS = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw',
    'thr', 'shr', 'str', 'spl', 'spr', 'scr', 'squ']);
  const PREFIXES = ['trans', 'mid', 'mis', 'non', 'un', 'ab', 'ad', 'con', 'com', 'ex', 'ob', 'dis', 'en', 'em', 'in', 'im', 'sub',
    'co', 'de', 'pre', 'pro', 're'];
  const PREFIX_STEP = { mid: '3.1', mis: '3.1', non: '3.1', trans: '3.1', un: '3.1', ab: '3.2', ad: '3.2', con: '3.2', com: '3.2',
    ex: '3.2', ob: '3.2', dis: '3.2', en: '3.2', em: '3.2', in: '3.2', im: '3.2', sub: '3.2', co: '5.1', de: '5.1', e: '5.1',
    pre: '5.1', pro: '5.1', re: '5.1' };
  const SYLLABLE_START = '3.1';

  function isVowelAt(w, i) {
    const c = w[i];
    if ('aeiou'.includes(c)) return !(c === 'u' && w[i - 1] === 'q');
    if (c === 'y') return i > 0 && !(w[i + 1] && 'aeiou'.includes(w[i + 1]));
    return false;
  }

  // Vowel sounds in a chunk: runs of vowels, ignoring a silent final e (VCe)
  function nuclei(w) {
    const out = [];
    for (let i = 0; i < w.length; i++) {
      if (!isVowelAt(w, i)) continue;
      const start = i;
      while (i + 1 < w.length && isVowelAt(w, i + 1) && w[i + 1] !== 'y') i++;
      out.push([start, i]);
    }
    if (out.length > 1) {
      const last = out[out.length - 1];
      const silentE = last[0] === w.length - 1 && w[w.length - 1] === 'e' && !isVowelAt(w, w.length - 2);
      if (silentE) out.pop();
    }
    return out;
  }

  function tokenize(cluster) {
    const toks = [];
    let i = 0;
    while (i < cluster.length) {
      const d = DIGRAPHS.find(g => cluster.startsWith(g, i));
      if (d) { toks.push(d); i += d.length; } else { toks.push(cluster[i]); i++; }
    }
    return toks;
  }

  function divideCore(w, open) {
    // a silent-e syllable inside a word ends after the e: base|ball, home|work
    const m = /[aeiou][b-df-hj-np-tv-z]e(?=[b-df-hj-np-tv-z])/.exec(w);
    if (m && m.index > 0) {
      const cut = m.index + 3;
      const left = w.slice(0, cut), right = w.slice(cut);
      if (nuclei(right).length && !/^[aeiou]/.test(right)) return divideCore(left, open).concat(divideCore(right, open));
    }
    const nu = nuclei(w);
    if (nu.length < 2) return [w];
    const parts = [];
    let from = 0;
    for (let k = 0; k < nu.length - 1; k++) {
      const a = nu[k][1] + 1, b = nu[k + 1][0];
      const toks = tokenize(w.slice(a, b));
      let keep;   // how many consonant tokens stay with the first syllable
      if (toks.length === 0) keep = 0;
      else if (toks.length === 1) keep = (open && !['ck', 'tch', 'x'].includes(toks[0])) ? 0 : 1;
      else if (toks.length === 2) keep = ['ck', 'tch'].includes(toks[1]) ? 2 : 1;
      else keep = BLENDS.has(toks.slice(1).join('')) ? 1 : 2;
      let cut = a;
      for (let t = 0; t < keep; t++) cut += toks[t].length;
      if (toks.length === 0) cut = a;   // vowel next to vowel: split between them
      parts.push(w.slice(from, cut));
      from = cut;
    }
    parts.push(w.slice(from));
    return parts.filter(Boolean);
  }

  const VOWEL_SUFFIX_SYLLABLE = new Set(['ing', 'ish', 'able', 'en', 'er', 'est', 'y', 'ive', 'or']);
  const CONS_SUFFIX = new Set(['ful', 'less', 'ness', 'ment', 'ly', 'ty']);

  function syllabify(word, step, overrides, known) {
    const w = normWord(word);
    if (overrides && overrides[w]) return overrides[w].slice();
    const n = stepNum(step);
    if (!(n >= stepNum(SYLLABLE_START))) return [w];
    let head = [], tail = [], core = w;

    // suffix first (only ones taught by this step)
    let attach = '';   // -s, -es and -ed that don't add a syllable join the last one
    const sfxs = Object.keys(SUFFIX_STEP).filter(x => stepNum(SUFFIX_STEP[x]) <= n).sort((a, b) => b.length - a.length);
    for (const sfx of sfxs) {
      if (!core.endsWith(sfx) || core.length - sfx.length < 3) continue;
      const base = core.slice(0, -sfx.length);
      if (!nuclei(base).length) continue;
      const vowelSfx = /^[aeiouy]/.test(sfx);
      // -y and -or are easy to mistake for part of the word (enemy, color): only split them off a known base
      if (known && (sfx === 'y' || sfx === 'or') && !known.has(base) && !deriveBase(core, sfx, known)) continue;
      if (sfx === 's' || (sfx === 'es' && !/(s|x|z|ch|sh)$/.test(base)) || (sfx === 'ed' && !/[td]$/.test(base))) {
        if (sfx === 'es' && !/(s|x|z|ch|sh)$/.test(base)) { attach = 's'; core = core.slice(0, -1); }
        else { attach = sfx; core = base; }
        break;
      }
      if (!(CONS_SUFFIX.has(sfx) || VOWEL_SUFFIX_SYLLABLE.has(sfx) || sfx === 'es' || sfx === 'ed')) continue;
      let suffixPart = sfx, b = base;
      // a doubled final consonant splits between the pair (hop|ping), but not bonus letters (spell|ing)
      if (vowelSfx && /([b-dghj-km-rtv-y])\1$/.test(b)) { suffixPart = b.slice(-1) + sfx; b = b.slice(0, -1); }
      tail = [suffixPart]; core = b;
      break;
    }

    // a prefix needs a consonant right after it and a vowel sound later (un|til, re|pel, not en|emy)
    const pre = PREFIXES.filter(p => stepNum(PREFIX_STEP[p]) <= n).sort((a, b) => b.length - a.length).find(p => {
      if (!core.startsWith(p) || core.length - p.length < 3) return false;
      const rest = core.slice(p.length);
      return !isVowelAt(rest, 0) && nuclei(rest).length > 0;
    });
    if (pre && nuclei(core.slice(pre.length)).length) { head = [pre]; core = core.slice(pre.length); }

    const parts = head.concat(divideCore(core, n >= 5.1), tail);
    if (attach) parts[parts.length - 1] += attach;
    return parts.length ? parts : [w];
  }

  // Teacher can type "bas-ket" or "bas/ket" in the plan to set the division
  function syllableOverrides(list) {
    const o = {};
    (list || []).forEach(raw => {
      const r = String(raw || '').trim().toLowerCase();
      if (!/[-/·]/.test(r)) return;
      const parts = r.split(/[-/·]+/).filter(Boolean);
      if (parts.length > 1 && parts.every(p => /^[a-z]+$/.test(p))) o[parts.join('')] = parts;
    });
    return o;
  }

  // ── Lesson context (built once per room) ────────────────────
  function buildContext(lesson) {
    const step = lesson.step;
    const n = stepNum(step);
    const review = new Set(lesson.reviewSteps || []);
    const real = BUILTIN.wordBank
      .filter(w => w.type === 'real' && !isNaN(stepNum(w.step)))
      .map(w => ({ step: w.step, word: normWord(w.word) }))
      .filter(w => isWord(w.word));

    const stripMarks = w => normWord(w).replace(/[-/·]/g, '');
    const overrides = syllableOverrides((lesson.curWords || []).concat(lesson.revWords || []));
    const planCur = (lesson.curWords || []).map(stripMarks).filter(isWord);
    const planRev = (lesson.revWords || []).map(stripMarks).filter(isWord);

    let current = uniq(real.filter(w => w.step === step).map(w => w.word));
    let reviewWords = uniq(real.filter(w => review.has(w.step)).map(w => w.word));
    const earlier = uniq(real.filter(w => stepNum(w.step) < n).map(w => w.word));
    const upTo = uniq(real.filter(w => stepNum(w.step) <= n).map(w => w.word));

    if (!reviewWords.length) reviewWords = earlier.slice();
    if (!current.length) current = reviewWords.length ? reviewWords.slice() : earlier.slice();
    if (!current.length) current = planCur.concat(planRev);
    if (!reviewWords.length) reviewWords = current.slice();

    const learned = learnedGraphemes(step);
    const hf = (BUILTIN.highFrequency || [])
      .filter(h => stepNum(h.step) <= n).map(h => normWord(h.word)).filter(isWord);
    const allWords = new Set(upTo.concat(current, reviewWords, planCur, planRev, hf));

    // Affix questions: words that are base + a taught suffix
    const suffixes = Object.keys(SUFFIX_STEP)
      .filter(s => stepNum(SUFFIX_STEP[s]) <= n)
      .sort((a, b) => b.length - a.length);
    const affixSource = uniq(planCur.concat(planRev, current, reviewWords));
    const affixes = [];
    affixSource.forEach(w => {
      // Prefer a plain "just add it" split, then the spelling-rule ones
      const found = suffixes.map(sfx => ({ sfx, d: deriveBase(w, sfx, allWords) })).filter(x => x.d);
      const best = found.find(x => x.d.rule === 'add') || found[0];
      if (best) affixes.push({ word: w, base: best.d.base, suffix: best.sfx, rule: best.d.rule });
    });

    // Morphology meanings (Latin bases / Greek forms taught so far)
    const meanings = (typeof SOUND_CARDS !== 'undefined' ? SOUND_CARDS : [])
      .filter(c => (c.cat === 'latin' || c.cat === 'greek') && stepNum(c.step) <= n)
      .filter(c => c.sounds && c.sounds[0] && !String(c.sounds[0].p).startsWith('/'))
      .map(c => ({ part: c.grapheme, meaning: c.sounds[0].p, example: c.sounds[0].k }));

    // Sound cards: the lesson's deck, or everything taught so far
    const visibleSounds = card => (card.sounds || [])
      .filter(s => String(s.p).startsWith('/'))
      .filter(s => stepNum(s.sub || card.step) <= n)
      .map(s => s.p);
    const soundable = (typeof SOUND_CARDS !== 'undefined' ? SOUND_CARDS : [])
      .filter(c => ['consonant', 'vowel', 'welded', 'suffix'].includes(c.cat))
      .filter(c => stepNum(c.step) <= n && visibleSounds(c).length);
    const deckKeys = new Set((lesson.deck || []).map(d => d.grapheme + '|' + d.step));
    let soundCards = soundable.filter(c => deckKeys.has(c.grapheme + '|' + c.step));
    if (!soundCards.length) soundCards = soundable;
    const allPhonemes = uniq(soundable.flatMap(visibleSounds));

    // Plan words are weighted 3x so the game reviews this lesson first
    const weight = (list, plan) => list.concat(plan, plan, plan);
    return {
      step,
      pools: {
        current: weight(current, planCur),
        review: weight(reviewWords, planRev),
      },
      learned,
      allWords,
      overrides,
      syllablesOn: n >= stepNum(SYLLABLE_START),
      affixes,
      meanings,
      sounds: soundCards.map(c => ({ grapheme: c.grapheme, sounds: visibleSounds(c) })),
      allPhonemes,
    };
  }

  function deriveBase(w, sfx, allWords) {
    if (!w.endsWith(sfx) || w.length - sfx.length < 2) return null;
    const b = w.slice(0, -sfx.length);
    const vowelSuffix = /^[aeiouy]/.test(sfx) && sfx !== 'es';
    if (allWords.has(b) && b.length >= 2) return { base: b, rule: 'add' };
    if (vowelSuffix && /([b-df-hj-np-tv-z])\1$/.test(b) && allWords.has(b.slice(0, -1)))
      return { base: b.slice(0, -1), rule: 'double' };
    if (vowelSuffix && allWords.has(b + 'e')) return { base: b + 'e', rule: 'drop-e' };
    return null;
  }

  // ── Question generation ────────────────────────────────────
  function pickWord(ctx, used) {
    const fromCurrent = Math.random() < 0.8;
    const pool = fromCurrent ? ctx.pools.current : ctx.pools.review;
    const fresh = pool.filter(w => !used.has(w));
    const list = fresh.length ? fresh : (pool.length ? pool : ctx.pools.current);
    return rand(list);
  }

  function distractorTiles(tiles, learned) {
    const have = new Set(tiles.map(t => t.g));
    const out = [];
    const vowels = ['a', 'e', 'i', 'o', 'u'].filter(v => !have.has(v));
    if (vowels.length) out.push(rand(vowels));
    const multiInWord = tiles.filter(t => t.g.length > 1);
    const pool = Array.from(learned).filter(g =>
      !have.has(g) && !out.includes(g) && g.length <= 3 &&
      !['latin', 'greek', 'prefix'].includes(catOf(g)));
    if (multiInWord.length) {
      const target = tileColor(rand(multiInWord).g);
      const same = pool.filter(g => g.length > 1 && tileColor(g) === target);
      if (same.length) out.push(rand(same));
    }
    const want = tiles.length <= 3 ? 2 : 3;
    let guard = 0;
    while (out.length < want && pool.length && guard++ < 50) {
      const g = rand(pool);
      if (!out.includes(g)) out.push(g);
    }
    return out.map(g => ({ g, c: tileColor(g) }));
  }

  function availableTypes(ctx) {
    const t = [
      { type: 'tiles', w: 40 },
      { type: 'spell', w: 25 },
    ];
    if (ctx.affixes.length) t.push({ type: 'affix', w: 15 });
    if (ctx.meanings.length >= 4) t.push({ type: 'meaning', w: 12 });
    if (ctx.sounds.length && ctx.allPhonemes.length >= 4) t.push({ type: 'sound', w: 10 });
    return t;
  }

  function chooseType(ctx, kind) {
    let list = availableTypes(ctx);
    if (kind === 'speed') list = list.filter(t => t.type !== 'tiles' || list.length === 1);
    const total = list.reduce((s, t) => s + t.w, 0);
    let r = Math.random() * total;
    for (const t of list) { if ((r -= t.w) < 0) return t.type; }
    return list[0].type;
  }

  function makeQuestion(ctx, used, kind) {
    const type = chooseType(ctx, kind);
    if (type === 'affix') {
      const fresh = ctx.affixes.filter(a => !used.has(a.word));
      const a = rand(fresh.length ? fresh : ctx.affixes);
      return { type, base: a.base, suffix: a.suffix, rule: a.rule, answer: a.word, word: a.word };
    }
    if (type === 'meaning') {
      const m = rand(ctx.meanings);
      const others = shuffle(uniq(ctx.meanings.map(x => x.meaning).filter(x => x !== m.meaning))).slice(0, 3);
      return { type, part: m.part, example: m.example, options: shuffle([m.meaning, ...others]), answer: m.meaning, word: m.part };
    }
    if (type === 'sound') {
      const card = rand(ctx.sounds);
      const right = card.sounds[0];
      const wrong = shuffle(ctx.allPhonemes.filter(p => !card.sounds.includes(p))).slice(0, 3);
      return { type, grapheme: card.grapheme, options: shuffle([right, ...wrong]), answer: right, word: card.grapheme };
    }
    const word = pickWord(ctx, used);
    const syl = ctx.syllablesOn ? syllabify(word, ctx.step, ctx.overrides, ctx.allWords) : [word];
    const syllables = syl.length > 1 ? syl : null;
    if (type === 'tiles') {
      // build tiles syllable by syllable so no tile crosses a syllable line
      const tiles = syllables ? syllables.flatMap(p => segment(p, ctx.learned, ctx.allWords)) : segment(word, ctx.learned, ctx.allWords);
      const all = shuffle(tiles.concat(distractorTiles(tiles, ctx.learned)));
      return { type, word, answer: word, tiles: all, slots: tiles.length, syllables };
    }
    if (syllables) {
      // syllable spelling: type into the cards, or switch to tiles
      const tiles = syllables.flatMap(p => segment(p, ctx.learned, ctx.allWords));
      return { type: 'spell', word, answer: word, syllables, tiles: shuffle(tiles.concat(distractorTiles(tiles, ctx.learned))) };
    }
    return { type: 'spell', word, answer: word, syllables };
  }

  // Syllable answers come in as "bas·ket": the word must be spelled right and
  // every card must hold a real syllable (a vowel sound). The expected split is
  // shown in the results, but a reasonable different split isn't marked wrong.
  function checkAnswer(q, value) {
    if (q.type === 'meaning' || q.type === 'sound') return value === q.answer;
    const v = String(value || '');
    if (v.includes('·')) {
      const parts = v.split('·').map(normWord);
      if (parts.some(p => !p || !/[aeiouy]/.test(p))) return false;
      return parts.join('') === normWord(q.answer);
    }
    return normWord(v).replace(/\s+/g, '') === normWord(q.answer);
  }

  function promptText(q) {
    if (q.type === 'affix') return `${q.base} + -${q.suffix}`;
    if (q.type === 'meaning') return `meaning of “${q.part}”`;
    if (q.type === 'sound') return `sound of “${q.grapheme}”`;
    return q.word;
  }

  const TYPE_LABEL = {
    tiles: 'Word Building', spell: 'Spelling', affix: 'Suffix Challenge',
    meaning: 'Word Meaning', sound: 'Sound Check',
  };

  // ── Round scoring ──────────────────────────────────────────
  // players: { p1: {coins, army, ...}, p2: {...} }   answers: { p1: {value, correct, ms} }
  // round: { n, kind, q, attack: {target, by} | null }
  // Returns per-player deltas plus readable lines; the host applies them.
  function resolveRound(round, players, answers, names) {
    const ids = Object.keys(players);
    const d = {};
    const lines = [];
    const logs = {};
    const nm = id => (names && names[id]) || id;
    ids.forEach(id => { d[id] = { pts: 0, coins: 0, army: 0, correct: 0, wrong: 0 }; });

    ids.forEach(id => {
      const a = answers[id];
      const ok = !!(a && a.correct);
      logs[id] = {
        n: round.n, type: round.q.type, prompt: promptText(round.q), answer: round.q.answer,
        given: a ? String(a.value || '') : '', timedOut: !a, correct: ok, kind: round.kind,
      };
      if (ok) {
        d[id].pts += ECON.correctPts; d[id].coins += ECON.correctCoins; d[id].army += ECON.correctArmy; d[id].correct = 1;
        lines.push(`${nm(id)} got it right: +${ECON.correctCoins} 🪙 +${ECON.correctArmy} ⚔️`);
      } else {
        const loss = Math.min(ECON.wrongCoins, players[id].coins || 0);
        d[id].coins -= loss; d[id].wrong = 1;
        lines.push(a ? `${nm(id)} missed it: −${loss} 🪙` : `${nm(id)} ran out of time: −${loss} 🪙`);
      }
    });

    let speedWinner = null;
    if (round.kind === 'speed' && ids.length === 2) {
      const right = ids.filter(id => answers[id] && answers[id].correct)
        .sort((a, b) => (answers[a].ms || 0) - (answers[b].ms || 0));
      if (right.length) {
        speedWinner = right[0];
        const loser = ids.find(id => id !== speedWinner);
        const steal = Math.max(0, Math.min(ECON.speedSteal, (players[loser].coins || 0) + d[loser].coins));
        d[speedWinner].coins += ECON.speedCoins + steal; d[speedWinner].army += ECON.speedArmy;
        d[loser].coins -= steal;
        lines.push(`⚡ ${nm(speedWinner)} wins the Speed Battle: +${ECON.speedCoins} 🪙 +${ECON.speedArmy} ⚔️` +
          (steal ? ` and steals ${steal} 🪙` : ''));
      } else {
        lines.push('⚡ Nobody won the Speed Battle.');
      }
    }

    let attackResult = null;
    if (round.attack && players[round.attack.target] && players[round.attack.by]) {
      const { target, by } = round.attack;
      if (answers[target] && answers[target].correct) {
        d[target].coins += ECON.defendCoins; d[target].army += ECON.defendArmy;
        attackResult = 'defended';
        lines.push(`🛡️ ${nm(target)} defended the surprise attack: +${ECON.defendCoins} 🪙 +${ECON.defendArmy} ⚔️`);
      } else {
        const cap = Math.max(0, Math.min(ECON.attackCapture, (players[target].army || 0) + d[target].army));
        d[target].army -= cap; d[by].army += cap;
        attackResult = 'captured';
        lines.push(`💥 ${nm(by)}'s surprise attack captured ${cap} of ${nm(target)}'s soldiers`);
      }
    }

    return { deltas: d, lines, logs, speedWinner, attackResult };
  }

  function winnerOf(players) {
    const ids = Object.keys(players);
    if (ids.length < 2) return ids[0] || null;
    const [a, b] = ids.map(id => ({ id, ...players[id] }));
    const cmp = (x, y) => (x.army - y.army) || (x.coins - y.coins) || (x.pts - y.pts);
    const c = cmp(a, b);
    return c > 0 ? a.id : c < 0 ? b.id : 'tie';
  }

  function roundKind(n) { return n % TIMING.speedEvery === 0 ? 'speed' : 'normal'; }

  // ── BOT ────────────────────────────────────────────────────
  const BOT_NAMES = ['Sir Syllable', 'Captain Vowel', 'General Grapheme', 'Baron Blend', 'Duke Digraph'];

  function misspell(word) {
    const w = String(word);
    if (w.length < 3) return w + w.slice(-1);
    const i = 1 + Math.floor(Math.random() * (w.length - 2));
    return Math.random() < 0.5
      ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)   // swap two letters
      : w.slice(0, i) + w.slice(i + 1);                    // drop one letter
  }

  function botAnswer(q, accuracy) {
    const right = Math.random() < (accuracy == null ? 0.7 : accuracy);
    if (right) return { value: q.syllables ? q.syllables.join('·') : q.answer, correct: true };
    if (q.options) {
      const wrong = q.options.filter(o => o !== q.answer);
      return { value: rand(wrong), correct: false };
    }
    let v = misspell(q.answer);
    if (v === q.answer) v = q.answer + 'e';
    return { value: v, correct: false };
  }

  function botDelayMs(kind) {
    return kind === 'speed' ? 3000 + Math.random() * 7000 : 5000 + Math.random() * 9000;
  }

  // What the BOT buys between rounds: list of 'soldier' | 'knight' | 'attack'
  function botShop(me, canAttack) {
    const buys = [];
    let coins = me.coins;
    if (canAttack && coins >= ECON.attackCost + 30 && Math.random() < 0.3) { buys.push('attack'); coins -= ECON.attackCost; }
    if (coins >= ECON.knightCost + 20 && Math.random() < 0.5) { buys.push('knight'); coins -= ECON.knightCost; }
    else if (coins >= ECON.soldierCost + 30 && Math.random() < 0.5) { buys.push('soldier'); coins -= ECON.soldierCost; }
    return buys;
  }

  global.WBRBattle = {
    ECON, TIMING, TYPE_LABEL, BOT_NAMES,
    parseWordBox, buildContext, segment, tileColor, learnedGraphemes,
    makeQuestion, checkAnswer, syllabify, syllableOverrides, promptText, resolveRound, winnerOf, roundKind,
    botAnswer, botDelayMs, botShop, shuffle, deriveBase,
  };
})(typeof window !== 'undefined' ? window : globalThis);
