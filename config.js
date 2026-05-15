// ============================================================
// Word Battle Royale — config.js
// Ported from LCONFIG + BUILTIN (was commented out in Apps Script)
// ============================================================

const LCONFIG = {
  DEFAULT_STEP: '2.1',
  MAX_SYLLABLES: 6,
  ROOM_EXPIRES_MIN: 240,
  // Firebase collection names (replaces SHEET_NAMES)
  COLLECTIONS: {
    ROOMS:     'wbr_rooms',
    WORD_BANK: 'wbr_wordBank',
    MEANINGS:  'wbr_meanings',
    HF:        'wbr_highFrequency',
    PROFILES:  'wbr_profiles',
    SUMMARIES: 'wbr_summaries',
  },
};

const BUILTIN = {
  graphemesByStep: {
    '1.3': ['a','e','i','o','u','m','n','p','b','t','d','k','g','f','s','z','l','r','h','w','wh','sh','th','ch','ck'],
    '1.4': ['all','am','an','ff','ll','ss','zz','qu','x'],
    '2.1': ['ang','ank','ing','ink','ong','onk','ung','unk','all','am','an','sh','th','ch','ck'],
    '3.1': ['ed','ing','s','es'],
  },

  highFrequency: [
    { step: '1.3', word: 'the' },
    { step: '1.3', word: 'and' },
    { step: '2.1', word: 'with' },
    { step: '2.1', word: 'from' },
  ],

  wordBank: [
    { step: '1.3', word: 'map' },
    { step: '1.3', word: 'ship' },
    { step: '1.4', word: 'ball' },
    { step: '2.1', word: 'sank' },
    { step: '2.1', word: 'song' },
    { step: '2.1', word: 'sunk' },
  ],
};
