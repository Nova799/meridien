/* Méridien v2 — carnet d'intention. Notebook local-first. Vanilla JS, zéro dépendance, zéro réseau. */
'use strict';

var K_CARNETS  = 'meridien.carnets';
var K_QUESTIONS= 'meridien.questions';
var K_PAGES    = 'meridien.pages';
var K_PREFS    = 'meridien.prefs';
var K_V1       = 'meridien.entries.v1';
var K_CLOUD    = 'meridien.cloudKey';

var CARNET_COLORS = ['#C8762C', '#8A9B7E', '#B4432E', '#4A5A6A', '#5D4A5A', '#3E5A44'];

var DEFAULT_QUESTIONS = [
  'Qu’est-ce qui compte, aujourd’hui ?',
  'Qu’est-ce que je remets à demain ?',
  'Pour quoi suis-je reconnaissant ?',
  'De quoi ai-je besoin, là, maintenant ?',
  'Qu’est-ce que j’évite d’écrire ?',
  'Quelle petite chose ai-je faite aujourd’hui ?',
  'Qu’est-ce qui mérite mon attention aujourd’hui ?',
  'À qui ai-je envie d’écrire ?',
  'Qu’est-ce que je laisserais tomber si j’osais ?',
  'Qu’est-ce que je veux me rappeler demain ?',
  'Quelle est la chose la plus simple à faire maintenant ?',
  'Qu’est-ce qui me rend vivant, en ce moment ?'
];

var FEEDBACK_AFTER_SAVE = 'Noté. À demain pour la suite.';
var EXPORT_FEEDBACK     = 'Archive exportée — méridien-export.json';
var IMPORT_INVALID      = 'Ce fichier n’est pas une archive Méridien.';

/* ============================================================
   Utilitaires dates (locales, pas UTC)
   ============================================================ */
function pad2(n) { return String(n).padStart(2, '0'); }

function toISO(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function fromISO(iso) {
  var p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function todayISO() { return toISO(new Date()); }

function addDaysISO(iso, delta) {
  var d = fromISO(iso);
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

function frenchLong(iso) {
  var d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch (e) {
    return d.toDateString();
  }
}

function frenchCaps(iso) {
  var d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      .format(d)
      .toUpperCase()
      .replace(/\./g, '');
  } catch (e) {
    return d.toDateString().toUpperCase();
  }
}

function frenchShort(iso) {
  var d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
  } catch (e) {
    return iso;
  }
}

function monthLong(date) {
  try {
    var s = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
  }
}

var uidCounter = 0;
function uid() {
  uidCounter += 1;
  return Date.now().toString(36) + '-' + uidCounter.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fold(s) {
  try {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    return String(s).toLowerCase();
  }
}

/* ============================================================
   FNV-1a + RNG déterministe
   ============================================================ */
var encoder = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;

function fnv1a(str) {
  var h = 0x811c9dc5 >>> 0;
  var bytes = encoder ? encoder.encode(str) : Array.prototype.map.call(str, function (c) { return c.charCodeAt(0) & 0xff; });
  for (var i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   Persistance localStorage
   ============================================================ */
function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var obj = JSON.parse(raw);
    return (obj === null || obj === undefined) ? fallback : obj;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

var state = {
  carnets: [],
  questions: [],
  pages: [],
  prefs: { theme: 'day', activeCarnet: null, onboarded: false },
  route: '/',
  viewMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  searchResults: [],
  searchIndex: 0,
  searchTrigger: null,
  paletteMode: 'actions',      // actions | carnet | date | new-carnet
  paletteIndex: 0,
  paletteTrigger: null,
  carnetModalMode: 'create',   // create | rename
  pendingImport: null,
  detailReturnFocus: null
};

function saveCarnets()  { return saveJSON(K_CARNETS, state.carnets); }
function saveQuestions(){ return saveJSON(K_QUESTIONS, state.questions); }
function savePages()    { return saveJSON(K_PAGES, state.pages); }
function savePrefs()    { return saveJSON(K_PREFS, state.prefs); }

function loadAll() {
  state.carnets   = loadJSON(K_CARNETS, []);
  state.questions = loadJSON(K_QUESTIONS, []);
  state.pages     = loadJSON(K_PAGES, []);
  state.prefs     = loadJSON(K_PREFS, { theme: 'day', activeCarnet: null, onboarded: false }) || {};
  if (!Array.isArray(state.carnets))   state.carnets = [];
  if (!Array.isArray(state.questions)) state.questions = [];
  if (!Array.isArray(state.pages))     state.pages = [];
  if (!state.prefs || typeof state.prefs !== 'object') state.prefs = {};
  if (state.prefs.theme !== 'night' && state.prefs.theme !== 'day') state.prefs.theme = 'day';
  if (typeof state.prefs.onboarded !== 'boolean') state.prefs.onboarded = false;
}

/* Migration douce v1 → v2 : meridien.entries.v1 devient un carnet « Intention » */
function migrateV1() {
  try {
    var raw = localStorage.getItem(K_V1);
    if (!raw) return;
    var obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    var dates = Object.keys(obj).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k) && obj[k] && typeof obj[k].text === 'string';
    });
    if (!dates.length) return;

    var intention = null;
    for (var i = 0; i < state.carnets.length; i++) {
      if (fold(state.carnets[i].nom) === 'intention') { intention = state.carnets[i]; break; }
    }
    if (!intention) {
      intention = {
        id: uid(),
        nom: 'Intention',
        couleur: CARNET_COLORS[0],
        questionId: 'q1',
        rotation: false
      };
      state.carnets.push(intention);
    }
    var migrated = 0;
    dates.forEach(function (iso) {
      var exists = state.pages.some(function (p) { return p.carnetId === intention.id && p.dateISO === iso; });
      if (exists) return;
      var text = obj[iso].text;
      state.pages.push({
        id: uid(),
        carnetId: intention.id,
        dateISO: iso,
        texte: text,
        tags: [],
        question: DEFAULT_QUESTIONS[0],
        seed: fnv1a(iso + text)
      });
      migrated += 1;
    });
    if (!state.prefs.activeCarnet) state.prefs.activeCarnet = intention.id;
    if (migrated > 0) state.prefs.onboarded = true;
    saveCarnets();
    savePages();
    savePrefs();
    // La clé v1 est conservée : aucune donnée n'est détruite.
  } catch (e) { /* migration best-effort */ }
}

function seedDefaultQuestions() {
  if (state.questions.length) return;
  state.questions = DEFAULT_QUESTIONS.map(function (texte, i) {
    return { id: 'q' + (i + 1), texte: texte, custom: false };
  });
  saveQuestions();
}

/* ============================================================
   Carnets — helpers
   ============================================================ */
function carnetById(id) {
  for (var i = 0; i < state.carnets.length; i++) {
    if (state.carnets[i].id === id) return state.carnets[i];
  }
  return null;
}

function activeCarnet() {
  var c = carnetById(state.prefs.activeCarnet);
  if (!c && state.carnets.length) {
    c = state.carnets[0];
    state.prefs.activeCarnet = c.id;
    savePrefs();
  }
  return c;
}

function ensureActiveCarnet() {
  var c = activeCarnet();
  if (c) return c;
  c = { id: uid(), nom: 'Intention', couleur: CARNET_COLORS[0], questionId: 'q1', rotation: false };
  state.carnets.push(c);
  state.prefs.activeCarnet = c.id;
  saveCarnets();
  savePrefs();
  return c;
}

function nextCarnetColor() {
  return CARNET_COLORS[state.carnets.length % CARNET_COLORS.length];
}

function setActiveCarnet(id) {
  if (!carnetById(id)) return;
  state.prefs.activeCarnet = id;
  savePrefs();
  renderCarnetTabs();
  setRoute(state.route); // re-render la vue courante
}

function createCarnet(name) {
  var nom = String(name || '').trim();
  if (!nom) { showToast('Nom du carnet vide.'); return null; }
  for (var i = 0; i < state.carnets.length; i++) {
    if (fold(state.carnets[i].nom) === fold(nom)) {
      setActiveCarnet(state.carnets[i].id);
      showToast('Carnet « ' + state.carnets[i].nom + ' » ouvert.');
      return state.carnets[i];
    }
  }
  var c = { id: uid(), nom: nom, couleur: nextCarnetColor(), questionId: 'q1', rotation: false };
  state.carnets.push(c);
  state.prefs.activeCarnet = c.id;
  saveCarnets();
  savePrefs();
  renderCarnetTabs();
  setRoute(state.route);
  showToast('Carnet « ' + c.nom + ' » ouvert.');
  return c;
}

function deleteActiveCarnet() {
  if (state.carnets.length <= 1) {
    showToast('Méridien garde au moins un carnet.');
    return;
  }
  var c = activeCarnet();
  if (!c) return;
  state.carnets = state.carnets.filter(function (x) { return x.id !== c.id; });
  state.pages   = state.pages.filter(function (p) { return p.carnetId !== c.id; });
  state.prefs.activeCarnet = state.carnets[0].id;
  saveCarnets();
  savePages();
  savePrefs();
  renderCarnetTabs();
  setRoute(state.route);
  showToast('Carnet « ' + c.nom + ' » supprimé.');
}

/* ============================================================
   Pages — helpers
   ============================================================ */
function pagesOf(carnetId) {
  return state.pages.filter(function (p) { return p.carnetId === carnetId; });
}

function pageFor(carnetId, iso) {
  for (var i = 0; i < state.pages.length; i++) {
    if (state.pages[i].carnetId === carnetId && state.pages[i].dateISO === iso) return state.pages[i];
  }
  return null;
}

function upsertPage(carnetId, iso, texte, tags, question) {
  var existing = pageFor(carnetId, iso);
  var seed = fnv1a(iso + texte);
  if (existing) {
    existing.texte = texte;
    existing.tags = tags;
    existing.question = question;
    existing.seed = seed;
    return existing;
  }
  var page = { id: uid(), carnetId: carnetId, dateISO: iso, texte: texte, tags: tags, question: question, seed: seed };
  state.pages.push(page);
  return page;
}

function pageDatesAll() {
  var set = {};
  state.pages.forEach(function (p) {
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p.dateISO)) set[p.dateISO] = true;
  });
  return Object.keys(set).sort();
}

function pageCountByDate() {
  var map = {};
  state.pages.forEach(function (p) {
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.dateISO)) return;
    map[p.dateISO] = (map[p.dateISO] || 0) + 1;
  });
  return map;
}

function uniquePageDates() {
  return pageDatesAll();
}

function datesWithPageInCarnet(carnetId) {
  var set = {};
  pagesOf(carnetId).forEach(function (p) { set[p.dateISO] = true; });
  return set;
}

/* Série consécutive se terminant à `iso` dans un carnet (Set de dates) */
function streakInSet(set, iso) {
  var streak = 0;
  var cursor = iso;
  while (set[cursor]) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
    if (streak > 100000) break;
  }
  return streak;
}

function currentStreakGlobal() {
  var dates = uniquePageDates();
  if (!dates.length) return 0;
  var set = {};
  dates.forEach(function (d) { set[d] = true; });
  var t = todayISO();
  if (set[t]) return streakInSet(set, t);
  var y = addDaysISO(t, -1);
  if (set[y]) return streakInSet(set, y);
  return 0;
}

function longestStreakGlobal() {
  var dates = uniquePageDates();
  var best = 0, run = 0, prev = null;
  for (var i = 0; i < dates.length; i++) {
    if (prev && addDaysISO(prev, 1) === dates[i]) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = dates[i];
  }
  return best;
}

/* ============================================================
   Question par carnet (banque + rotation quotidienne)
   ============================================================ */
function questionById(id) {
  for (var i = 0; i < state.questions.length; i++) {
    if (state.questions[i].id === id) return state.questions[i];
  }
  return null;
}

function questionForCarnet(carnet, iso) {
  if (!carnet) return DEFAULT_QUESTIONS[0];
  var list = state.questions.length ? state.questions : DEFAULT_QUESTIONS.map(function (t, i) { return { id: 'q' + (i + 1), texte: t }; });
  if (carnet.rotation) {
    var idx = fnv1a('rotation:' + iso) % list.length;
    return list[idx].texte;
  }
  var q = questionById(carnet.questionId);
  return q ? q.texte : list[0].texte;
}

function tagsOf(page) {
  return Array.isArray(page.tags) ? page.tags : [];
}

function parseTags(raw) {
  var out = [];
  String(raw || '').split(',').forEach(function (chunk) {
    var t = chunk.trim().replace(/^#+/, '').trim();
    if (!t) return;
    var exists = out.some(function (x) { return fold(x) === fold(t); });
    if (!exists) out.push(t);
  });
  return out;
}

/* ============================================================
   Thème — Encre de jour / Encre de nuit
   ============================================================ */
function applyTheme(theme) {
  var t = (theme === 'night') ? 'night' : 'day';
  state.prefs.theme = t;
  document.body.setAttribute('data-theme', t);
  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = (t === 'night') ? 'Encre de jour' : 'Encre de nuit';
    btn.setAttribute('aria-pressed', t === 'night' ? 'true' : 'false');
  }
}

function toggleTheme() {
  applyTheme(state.prefs.theme === 'night' ? 'day' : 'night');
  savePrefs();
  showToast(state.prefs.theme === 'night' ? 'Encre de nuit' : 'Encre de jour');
}

/* ============================================================
   Éléments DOM
   ============================================================ */
var views = {
  '/': document.getElementById('view-today'),
  '/archive': document.getElementById('view-archive'),
  '/stats': document.getElementById('view-stats'),
  '/annee': document.getElementById('view-annee'),
  '/bienvenue': document.getElementById('view-bienvenue')
};

var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));

var todayDateEl   = document.getElementById('today-date');
var todayQuestion = document.getElementById('today-question');
var entryEl       = document.getElementById('entry');
var tagsEl        = document.getElementById('tags');
var saveBtn       = document.getElementById('save-btn');
var editNote      = document.getElementById('edit-note');
var carnetFresh   = document.getElementById('carnet-fresh');
var saveFeedback  = document.getElementById('save-feedback');
var savedStamp    = document.getElementById('saved-stamp');
var changeQuestionBtn = document.getElementById('change-question');
var rotationToggle    = document.getElementById('rotation-toggle');
var rotationState     = document.getElementById('rotation-state');
var carnetTabsEl      = document.getElementById('carnet-tabs');
var newCarnetBtn      = document.getElementById('new-carnet');
var renameCarnetBtn   = document.getElementById('rename-carnet');
var deleteCarnetBtn   = document.getElementById('delete-carnet');

var archiveContext = document.getElementById('archive-context');
var calendarEl     = document.getElementById('calendar');
var monthLabel     = document.getElementById('month-label');
var prevMonthBtn   = document.getElementById('prev-month');
var nextMonthBtn   = document.getElementById('next-month');
var archiveEmpty   = document.getElementById('archive-empty');

var anneeContext  = document.getElementById('annee-context');
var heatmapEl     = document.getElementById('heatmap');
var heatmapMonths = document.getElementById('heatmap-months');
var anneeEmpty    = document.getElementById('annee-empty');

var statsBody    = document.getElementById('stats-body');
var statsEmpty   = document.getElementById('stats-empty');
var streakNum    = document.getElementById('streak-num');
var streakZero   = document.getElementById('streak-zero');
var totalNum     = document.getElementById('total-num');
var longestNum   = document.getElementById('longest-num');
var bestPeriod   = document.getElementById('best-period');
var byCarnetEl   = document.getElementById('by-carnet');
var byWeekdayEl  = document.getElementById('by-weekday');
var exportBtn    = document.getElementById('export-btn');
var importBtn    = document.getElementById('import-btn');
var importFile   = document.getElementById('import-file');
var exportFeedback = document.getElementById('export-feedback');

var detailOverlay  = document.getElementById('detail-overlay');
var detailClose    = document.getElementById('detail-close');
var detailDate     = document.getElementById('detail-date');
var detailCarnetDot  = document.getElementById('detail-carnet-dot');
var detailCarnetName = document.getElementById('detail-carnet-name');
var detailQuestion = document.getElementById('detail-question');
var detailCover    = document.getElementById('detail-cover');
var detailStamp    = document.getElementById('detail-stamp');
var detailText     = document.getElementById('detail-text');
var detailTags     = document.getElementById('detail-tags');

var searchOverlay = document.getElementById('search-overlay');
var searchInput   = document.getElementById('search-input');
var searchMeta    = document.getElementById('search-meta');
var searchResults = document.getElementById('search-results');
var searchEmpty   = document.getElementById('search-empty');

var palette        = document.getElementById('palette');
var paletteInput   = document.getElementById('palette-input');
var paletteList    = document.getElementById('palette-list');

var carnetModal        = document.getElementById('carnet-modal');
var carnetModalTitle   = document.getElementById('carnet-modal-title');
var carnetNameInput    = document.getElementById('carnet-name');
var carnetModalCancel  = document.getElementById('carnet-modal-cancel');
var carnetModalConfirm = document.getElementById('carnet-modal-confirm');

var deleteModal        = document.getElementById('delete-modal');
var deleteModalSub     = document.getElementById('delete-modal-sub');
var deleteModalKeep    = document.getElementById('delete-modal-keep');
var deleteModalConfirm = document.getElementById('delete-modal-confirm');

var questionModal      = document.getElementById('question-modal');
var questionList       = document.getElementById('question-list');
var questionCustomInput= document.getElementById('question-custom-input');
var questionCustomAdd  = document.getElementById('question-custom-add');
var questionModalClose = document.getElementById('question-modal-close');

var importModal        = document.getElementById('import-modal');
var importModalSub     = document.getElementById('import-modal-sub');
var importModalCancel  = document.getElementById('import-modal-cancel');
var importModalMerge   = document.getElementById('import-modal-merge');
var importModalReplace = document.getElementById('import-modal-replace');

var cloudPassphrase = document.getElementById('cloud-passphrase');
var cloudSaveBtn    = document.getElementById('cloud-save-btn');
var cloudRestoreBtn = document.getElementById('cloud-restore-btn');
var cloudFeedback   = document.getElementById('cloud-feedback');
var restoreModal        = document.getElementById('restore-modal');
var restoreModalSub     = document.getElementById('restore-modal-sub');
var restoreModalCancel  = document.getElementById('restore-modal-cancel');
var restoreModalReplace = document.getElementById('restore-modal-replace');
var pendingCloudImport  = null;

var toastEl   = document.getElementById('toast');
var printLog  = document.getElementById('print-log');

/* ============================================================
   Toast
   ============================================================ */
var toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2800);
}

function flashFeedback(el, text) {
  el.textContent = text;
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');
}

/* ============================================================
   Router (hash)
   ============================================================ */
function normalizeRoute(hash) {
  var h = (hash || '').replace(/^#/, '');
  if (h === '' || h === '/') return '/';
  if (h === '/archive' || h === '/stats' || h === '/annee' || h === '/bienvenue') return h;
  return '/';
}

function currentRoute() { return normalizeRoute(window.location.hash); }

function setRoute(route) {
  state.route = route;
  var mainEl = document.getElementById('main');
  if (mainEl) mainEl.classList.toggle('wrap-wide', route === '/annee');
  Object.keys(views).forEach(function (r) {
    if (views[r]) views[r].hidden = (r !== route);
  });
  navLinks.forEach(function (a) {
    if (a.getAttribute('data-nav') === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (route === '/') onShowToday();
  else if (route === '/archive') renderArchive();
  else if (route === '/stats') renderStats();
  else if (route === '/annee') renderAnnee();
}

function navigate(route) {
  closeAllOverlays();
  if (currentRoute() === route) setRoute(route);
  else window.location.hash = '#' + route;
}

window.addEventListener('hashchange', function () {
  closeAllOverlays();
  setRoute(currentRoute());
});

/* ============================================================
   Vue Aujourd'hui
   ============================================================ */
function autosize() {
  entryEl.style.height = 'auto';
  entryEl.style.height = Math.max(140, entryEl.scrollHeight) + 'px';
}

/* Contraste du libellé d'onglet selon la luminance de la couleur du carnet */
function tabTextColor(hex) {
  var c = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return '#FBF8EF';
  var cr = function (a, b) {
    var hi = Math.max(a, b) + 0.05, lo = Math.min(a, b) + 0.05;
    return hi / lo;
  };
  var L = lumOf('#' + c);
  return cr(L, lumOf('#FBF8EF')) >= cr(L, lumOf('#221F1B')) ? '#FBF8EF' : '#221F1B';
}
function lumOf(hex) {
  var c = String(hex).replace('#', '');
  var f = function (i) {
    var v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}

function renderCarnetTabs() {
  if (!carnetTabsEl) return;
  carnetTabsEl.innerHTML = '';
  var active = activeCarnet();
  state.carnets.forEach(function (c) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-carnet';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', (active && active.id === c.id) ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Carnet ' + c.nom);
    btn.textContent = c.nom;
    btn.style.setProperty('--tab-color', c.couleur || CARNET_COLORS[0]);
    btn.style.color = tabTextColor(c.couleur || CARNET_COLORS[0]);
    btn.addEventListener('click', function () { setActiveCarnet(c.id); });
    carnetTabsEl.appendChild(btn);
  });
}

function onShowToday() {
  var carnet = ensureActiveCarnet();
  var t = todayISO();
  todayDateEl.textContent = frenchCaps(t);
  todayQuestion.textContent = questionForCarnet(carnet, t);

  rotationToggle.checked = !!carnet.rotation;
  rotationState.textContent = carnet.rotation ? 'activée' : 'désactivée';

  var existing = pageFor(carnet.id, t);
  if (existing && typeof existing.texte === 'string') {
    if (entryEl.value !== existing.texte) entryEl.value = existing.texte;
    if (document.activeElement !== tagsEl) tagsEl.value = tagsOf(existing).join(', ');
    editNote.hidden = false;
    savedStamp.hidden = false;
  } else {
    if (document.activeElement !== entryEl) entryEl.value = '';
    if (document.activeElement !== tagsEl) tagsEl.value = '';
    editNote.hidden = true;
    savedStamp.hidden = true;
  }

  carnetFresh.hidden = pagesOf(carnet.id).length !== 0;
  saveBtn.textContent = 'Garder cette page';
  saveBtn.classList.remove('is-saved');
  renderCarnetTabs();
  autosize();
}

function saveToday() {
  var carnet = ensureActiveCarnet();
  var t = todayISO();
  var text = entryEl.value.replace(/\s+$/, '');
  if (text.trim().length === 0) {
    flashFeedback(saveFeedback, 'Écrivez une ligne d’abord.');
    return;
  }
  var tags = parseTags(tagsEl.value);
  var question = todayQuestion.textContent;
  upsertPage(carnet.id, t, text, tags, question);
  if (!savePages()) {
    flashFeedback(saveFeedback, 'La page n’a pas pu être gardée (stockage indisponible).');
    return;
  }
  editNote.hidden = true;
  carnetFresh.hidden = true;
  savedStamp.hidden = false;
  saveBtn.textContent = 'Page gardée ✓';
  saveBtn.classList.add('is-saved');
  flashFeedback(saveFeedback, FEEDBACK_AFTER_SAVE);
  buildPrintLog();
}

entryEl.addEventListener('input', function () {
  autosize();
  saveBtn.textContent = 'Garder cette page';
  saveBtn.classList.remove('is-saved');
  savedStamp.hidden = true;
});

saveBtn.addEventListener('click', saveToday);

newCarnetBtn.addEventListener('click', function () { openCarnetModal('create'); });
renameCarnetBtn.addEventListener('click', function () { openCarnetModal('rename'); });
deleteCarnetBtn.addEventListener('click', function () {
  var c = activeCarnet();
  var n = c ? pagesOf(c.id).length : 0;
  deleteModalSub.textContent = c
    ? 'Supprimer « ' + c.nom + ' » et ses ' + n + ' page' + (n > 1 ? 's' : '') + ' ? Cette action ne peut pas être annulée.'
    : 'Cette action ne peut pas être annulée.';
  openOverlay(deleteModal);
});

rotationToggle.addEventListener('change', function () {
  var carnet = activeCarnet();
  if (!carnet) return;
  carnet.rotation = rotationToggle.checked;
  saveCarnets();
  rotationState.textContent = carnet.rotation ? 'activée' : 'désactivée';
  todayQuestion.textContent = questionForCarnet(carnet, todayISO());
});

changeQuestionBtn.addEventListener('click', openQuestionModal);

/* ============================================================
   Modale carnet — création / renommage
   ============================================================ */
function openCarnetModal(mode) {
  state.carnetModalMode = mode;
  var c = activeCarnet();
  if (mode === 'rename' && c) {
    carnetModalTitle.textContent = 'Renommer « ' + c.nom + ' »';
    carnetModalConfirm.textContent = 'Renommer';
    carnetModalCancel.textContent = 'Garder l’existant';
    carnetNameInput.value = c.nom;
  } else {
    carnetModalTitle.textContent = 'Nouveau carnet';
    carnetModalConfirm.textContent = 'Créer';
    carnetModalCancel.textContent = 'Annuler';
    carnetNameInput.value = '';
  }
  openOverlay(carnetModal);
  setTimeout(function () { carnetNameInput.focus(); carnetNameInput.select(); }, 0);
}

function submitCarnetModal() {
  var name = carnetNameInput.value.trim();
  if (!name) { showToast('Nom du carnet vide.'); return; }
  if (state.carnetModalMode === 'rename') {
    var c = activeCarnet();
    if (c) {
      c.nom = name;
      saveCarnets();
      renderCarnetTabs();
      setRoute(state.route);
      showToast('Carnet renommé « ' + name + ' ».');
    }
  } else {
    createCarnet(name);
  }
  closeOverlay(carnetModal);
}

carnetModalConfirm.addEventListener('click', submitCarnetModal);
carnetModalCancel.addEventListener('click', function () { closeOverlay(carnetModal); });
carnetNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); submitCarnetModal(); }
});

deleteModalKeep.addEventListener('click', function () { closeOverlay(deleteModal); });
deleteModalConfirm.addEventListener('click', function () {
  closeOverlay(deleteModal);
  deleteActiveCarnet();
});

/* ============================================================
   Modale question — banque + custom
   ============================================================ */
function renderQuestionList() {
  var carnet = activeCarnet();
  questionList.innerHTML = '';
  state.questions.forEach(function (q) {
    var li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'question-item';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', (carnet && carnet.questionId === q.id && !carnet.rotation) ? 'true' : 'false');
    btn.textContent = q.texte;
    btn.addEventListener('click', function () {
      var c = activeCarnet();
      if (!c) return;
      c.questionId = q.id;
      c.rotation = false;
      saveCarnets();
      todayQuestion.textContent = q.texte;
      rotationToggle.checked = false;
      rotationState.textContent = 'désactivée';
      closeOverlay(questionModal);
    });
    li.appendChild(btn);
    questionList.appendChild(li);
  });
}

function openQuestionModal() {
  renderQuestionList();
  openOverlay(questionModal);
}

questionCustomAdd.addEventListener('click', function () {
  var texte = questionCustomInput.value.trim();
  if (!texte) { showToast('Écrivez une question d’abord.'); return; }
  var q = { id: uid(), texte: texte, custom: true };
  state.questions.push(q);
  saveQuestions();
  var c = activeCarnet();
  if (c) {
    c.questionId = q.id;
    c.rotation = false;
    saveCarnets();
    todayQuestion.textContent = q.texte;
    rotationToggle.checked = false;
    rotationState.textContent = 'désactivée';
  }
  questionCustomInput.value = '';
  closeOverlay(questionModal);
  showToast('Question ajoutée à la banque.');
});
questionCustomInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); questionCustomAdd.click(); }
});
questionModalClose.addEventListener('click', function () { closeOverlay(questionModal); });

/* ============================================================
   Overlays — ouverture / fermeture / focus
   ============================================================ */
var openOverlays = [];

function openOverlay(overlay) {
  if (!overlay) return;
  if (overlay.hidden) {
    overlay.hidden = false;
    openOverlays.push(overlay);
    document.body.style.overflow = 'hidden';
    var focusable = overlay.querySelector('input, textarea, button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 0);
  }
}

function closeOverlay(overlay) {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  var i = openOverlays.indexOf(overlay);
  if (i !== -1) openOverlays.splice(i, 1);
  if (!openOverlays.length) document.body.style.overflow = '';
  if (overlay === searchOverlay && state.searchTrigger && document.contains(state.searchTrigger)) {
    state.searchTrigger.focus();
  } else if (overlay === palette && state.paletteTrigger && document.contains(state.paletteTrigger)) {
    state.paletteTrigger.focus();
  } else if (overlay === detailOverlay && state.detailReturnFocus && document.contains(state.detailReturnFocus)) {
    state.detailReturnFocus.focus();
  }
}

function closeAllOverlays() {
  [detailOverlay, searchOverlay, palette, carnetModal, deleteModal, questionModal, importModal, restoreModal].forEach(function (o) {
    if (o && !o.hidden) { o.hidden = true; }
  });
  openOverlays = [];
  document.body.style.overflow = '';
}

function trapTab(overlay, e) {
  var focusables = overlay.querySelectorAll('button, input, textarea, [tabindex]:not([tabindex="-1"])');
  var list = Array.prototype.filter.call(focusables, function (el) { return !el.disabled && el.offsetParent !== null; });
  if (!list.length) return;
  var first = list[0], last = list[list.length - 1];
  var active = document.activeElement;
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

/* ============================================================
   Couverture générative — ex-libris (FNV-1a conservé)
   ============================================================ */
function drawCover(canvas, dateISO, text, streakAtDate, seedOverride) {
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var W = canvas.width, H = canvas.height;
  var seed = (typeof seedOverride === 'number' && isFinite(seedOverride)) ? (seedOverride >>> 0) : fnv1a(dateISO + text);
  var rand = mulberry32(seed);

  var hue = seed % 360;
  var calm = Math.min(1, (text || '').length / 1200);
  var angleDeg = (seed % 90) + 30;
  var rad = angleDeg * Math.PI / 180;

  var cx = W / 2, cy = H / 2;
  var dx = Math.cos(rad) * (W + H) / 2, dy = Math.sin(rad) * (W + H) / 2;
  var grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, 'hsl(' + ((hue + 336) % 360) + ', 45%, 38%)');
  grad.addColorStop(0.5, 'hsl(' + hue + ', 45%, 53%)');
  grad.addColorStop(1, 'hsl(' + ((hue + 24) % 360) + ', 45%, 68%)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var motif = seed % 3;
  var ink = 'rgba(28, 26, 23, ';

  if (motif === 0) {
    var bands = 4 + Math.floor(rand() * 3);
    var baseAlpha = 0.16 - calm * 0.08;
    var bandH = (H / (bands * 2.4)) * (1 + calm * 0.6);
    for (var i = 0; i < bands; i++) {
      var y = (H / (bands + 1)) * (i + 1) + (rand() - 0.5) * H * 0.04;
      ctx.fillStyle = ink + (baseAlpha * (0.7 + rand() * 0.6)).toFixed(3) + ')';
      ctx.fillRect(0, y - bandH / 2, W, bandH);
    }
  } else if (motif === 1) {
    var corner = Math.floor(rand() * 4);
    var ox = (corner === 0 || corner === 3) ? 0 : W;
    var oy = (corner < 2) ? 0 : H;
    var arcs = 5 + Math.floor(rand() * 4);
    var maxR = Math.hypot(W, H);
    ctx.lineWidth = Math.max(2, (H / 160) * (1 + calm));
    var alpha = 0.22 - calm * 0.10;
    for (var r = maxR / arcs; r < maxR; r += maxR / arcs) {
      ctx.beginPath();
      ctx.strokeStyle = ink + (alpha * (0.65 + rand() * 0.7)).toFixed(3) + ')';
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    var dots = Math.floor((W * H) / (90 + calm * 110));
    var dotAlpha = 0.20 - calm * 0.09;
    for (var d = 0; d < dots; d++) {
      var px = rand() * W, py = rand() * H;
      var radDot = (0.6 + rand() * 1.4) * (W / 320 + 0.6);
      ctx.fillStyle = ink + (dotAlpha * (0.5 + rand())).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, radDot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (streakAtDate >= 7) {
    var ly = H * 0.72;
    ctx.strokeStyle = 'rgba(200, 118, 44, 0.85)';
    ctx.lineWidth = Math.max(1, H / 240);
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(W, ly);
    ctx.stroke();
  }

  /* Ex-libris : double bordure encre fine */
  ctx.strokeStyle = 'rgba(34, 31, 27, 0.75)';
  ctx.lineWidth = Math.max(1.5, W / 180);
  ctx.strokeRect(W * 0.035, H * 0.028, W * 0.93, H * 0.944);
  ctx.lineWidth = Math.max(0.75, W / 480);
  ctx.strokeRect(W * 0.055, H * 0.044, W * 0.89, H * 0.912);

  /* Date « JJ·MM » bas-droite, alpha 0,6 */
  var p = dateISO.split('-');
  ctx.fillStyle = 'rgba(250, 247, 242, 0.6)';
  ctx.font = '600 ' + Math.max(11, Math.round(W / 11)) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p[2] + '·' + p[1], W * 0.90, H * 0.925);
}

function coverLabel(iso) {
  return 'Couverture de la page du ' + frenchLong(iso);
}

/* ============================================================
   Détail plein écran d'une page
   ============================================================ */
function openPageDetail(page, sourceEl) {
  if (!page) return;
  var carnet = carnetById(page.carnetId);
  state.detailReturnFocus = sourceEl || document.activeElement;

  detailDate.textContent = frenchLong(page.dateISO);
  detailCarnetName.textContent = carnet ? carnet.nom : 'Carnet';
  detailCarnetDot.style.background = carnet ? (carnet.couleur || CARNET_COLORS[0]) : CARNET_COLORS[0];
  detailQuestion.textContent = page.question || DEFAULT_QUESTIONS[0];
  detailText.textContent = page.texte || '';

  detailTags.innerHTML = '';
  tagsOf(page).forEach(function (t) {
    var span = document.createElement('span');
    span.className = 'tag-chip';
    span.textContent = '#' + t;
    detailTags.appendChild(span);
  });

  detailCover.setAttribute('aria-label', coverLabel(page.dateISO));
  var set = datesWithPageInCarnet(page.carnetId);
  var streak = streakInSet(set, page.dateISO);
  drawCover(detailCover, page.dateISO, page.texte || '', streak, page.seed);

  openOverlay(detailOverlay);
  setTimeout(function () { detailClose.focus(); }, 0);
}

function openDetailForDate(iso) {
  var carnet = activeCarnet();
  var page = carnet ? pageFor(carnet.id, iso) : null;
  if (!page) {
    for (var i = 0; i < state.pages.length; i++) {
      if (state.pages[i].dateISO === iso) { page = state.pages[i]; break; }
    }
  }
  if (page) openPageDetail(page, null);
  else showToast('Aucune page ce jour-là.');
}

detailClose.addEventListener('click', function () { closeOverlay(detailOverlay); });
detailOverlay.addEventListener('click', function (e) {
  if (e.target === detailOverlay) closeOverlay(detailOverlay);
});

/* ============================================================
   Vue Archive — grille mensuelle (carnet actif)
   ============================================================ */
function changeMonth(delta) {
  state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + delta, 1);
  renderArchive();
}

prevMonthBtn.addEventListener('click', function () { changeMonth(-1); });
nextMonthBtn.addEventListener('click', function () { changeMonth(1); });

function renderArchive() {
  var carnet = ensureActiveCarnet();
  archiveContext.textContent = 'Carnet — ' + carnet.nom;

  var base = state.viewMonth;
  var year = base.getFullYear(), month = base.getMonth();
  monthLabel.textContent = monthLong(base);

  var pages = pagesOf(carnet.id);
  archiveEmpty.hidden = pages.length !== 0;

  calendarEl.innerHTML = '';

  var first = new Date(year, month, 1);
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var leading = (first.getDay() + 6) % 7;
  var tISO = todayISO();

  for (var b = 0; b < leading; b++) {
    var blank = document.createElement('div');
    blank.className = 'cal-cell cal-cell--blank';
    blank.setAttribute('aria-hidden', 'true');
    calendarEl.appendChild(blank);
  }

  var dateSet = {};
  pages.forEach(function (p) { dateSet[p.dateISO] = p; });

  for (var day = 1; day <= daysInMonth; day++) {
    var iso = year + '-' + pad2(month + 1) + '-' + pad2(day);
    var page = dateSet[iso];

    var cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell' + (page ? ' cal-cell--written' : '') + (iso === tISO ? ' cal-cell--today' : '');

    if (page) {
      cell.setAttribute('aria-label', 'Ouvrir la page du ' + frenchLong(iso));
      var canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', coverLabel(iso));
      cell.appendChild(canvas);
      calendarEl.appendChild(cell);
      var set = datesWithPageInCarnet(carnet.id);
      drawCover(canvas, iso, page.texte, streakInSet(set, iso), page.seed);
      (function (p, cellEl) {
        cellEl.addEventListener('click', function () { openPageDetail(p, cellEl); });
      })(page, cell);
    } else {
      cell.disabled = true;
      cell.setAttribute('aria-label', frenchLong(iso) + ' — jour sans page');
      calendarEl.appendChild(cell);
    }
  }
}

/* ============================================================
   Vue Année — heatmap 53×7 (tous carnets)
   ============================================================ */
var HEATMAP_COLS = 53;

function renderAnnee() {
  anneeContext.textContent = 'Tous carnets';
  var total = state.pages.length;
  anneeEmpty.hidden = total !== 0;

  var end = new Date();
  var endDow = (end.getDay() + 6) % 7;               // lundi = 0
  var lastMonday = new Date(end.getFullYear(), end.getMonth(), end.getDate() - endDow);
  var start = new Date(lastMonday);
  start.setDate(start.getDate() - (HEATMAP_COLS - 1) * 7);

  var counts = pageCountByDate();
  var tISO = todayISO();

  /* Étiquettes de mois — colonne qui contient le 1er du mois */
  heatmapMonths.innerHTML = '';
  var monthShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  for (var c = 0; c < HEATMAP_COLS; c++) {
    var colStart = new Date(start);
    colStart.setDate(colStart.getDate() + c * 7);
    var span = document.createElement('span');
    span.style.gridColumnStart = String(c + 1);
    for (var dayInCol = 0; dayInCol < 7; dayInCol++) {
      var dd = new Date(colStart);
      dd.setDate(dd.getDate() + dayInCol);
      if (dd.getDate() === 1) { span.textContent = monthShort[dd.getMonth()]; break; }
    }
    heatmapMonths.appendChild(span);
  }

  heatmapEl.innerHTML = '';
  var cells = [];
  for (var col = 0; col < HEATMAP_COLS; col++) {
    for (var row = 0; row < 7; row++) {
      var d = new Date(start);
      d.setDate(d.getDate() + col * 7 + row);
      var iso = toISO(d);
      var future = iso > tISO;
      var n = counts[iso] || 0;

      var cell;
      if (future) {
        cell = document.createElement('span');
        cell.className = 'hm-cell hm-future';
        cell.setAttribute('aria-hidden', 'true');
        heatmapEl.appendChild(cell);
        continue;
      }
      cell = document.createElement('button');
      cell.type = 'button';
      var level = n === 0 ? 0 : (n <= 2 ? 1 : (n <= 5 ? 2 : 3));
      cell.className = 'hm-cell hm-' + level + (iso === tISO ? ' hm-today' : '');
      var carnetsThatDay = {};
      state.pages.forEach(function (p) {
        if (p.dateISO === iso) {
          var cn = carnetById(p.carnetId);
          carnetsThatDay[cn ? cn.nom : '?'] = true;
        }
      });
      var names = Object.keys(carnetsThatDay);
      var label = frenchShort(iso) + ' — ' + (n === 0 ? 'aucune page' : (n === 1 && names.length === 1 ? names[0] : n + ' pages'));
      cell.setAttribute('aria-label', label);
      cell.title = label;
      if (n === 0) cell.classList.add('hm-empty');
      (function (isoDay) {
        cell.addEventListener('click', function () { openDetailForDate(isoDay); });
      })(iso);
      heatmapEl.appendChild(cell);
      cells.push(cell);
    }
  }

  /* ↑/↓ (et ←/→) naviguent dans la heatmap */
  heatmapEl.onkeydown = function (e) {
    var idx = cells.indexOf(document.activeElement);
    if (idx === -1) return;
    var target = null;
    if (e.key === 'ArrowUp') target = Math.max(0, idx - 1);
    else if (e.key === 'ArrowDown') target = Math.min(cells.length - 1, idx + 1);
    else if (e.key === 'ArrowLeft') target = Math.max(0, idx - 7);
    else if (e.key === 'ArrowRight') target = Math.min(cells.length - 1, idx + 7);
    if (target !== null) {
      e.preventDefault();
      if (cells[target]) cells[target].focus();
    }
  };
}

/* ============================================================
   Statistiques — enrichies
   ============================================================ */
function renderStats() {
  var total = state.pages.length;
  statsEmpty.hidden = total !== 0;
  statsBody.hidden = total === 0;
  if (total === 0) return;

  var streak = currentStreakGlobal();
  streakNum.textContent = String(streak);
  streakZero.hidden = streak !== 0;

  totalNum.textContent = String(total);
  longestNum.textContent = String(longestStreakGlobal());

  /* Meilleure période — mois le plus dense */
  var byMonth = {};
  state.pages.forEach(function (p) {
    var key = p.dateISO.slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + 1;
  });
  var bestKey = null, bestCount = 0;
  Object.keys(byMonth).forEach(function (k) {
    if (byMonth[k] > bestCount) { bestCount = byMonth[k]; bestKey = k; }
  });
  if (bestKey) {
    var parts = bestKey.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    var label;
    try {
      label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
      label = bestKey;
    }
    bestPeriod.textContent = label + ' — ' + bestCount + ' page' + (bestCount > 1 ? 's' : '');
  } else {
    bestPeriod.textContent = '—';
  }

  /* Par carnet — barres horizontales */
  byCarnetEl.innerHTML = '';
  var counts = state.carnets.map(function (c) {
    return { carnet: c, n: pagesOf(c.id).length };
  });
  var maxC = counts.reduce(function (m, x) { return Math.max(m, x.n); }, 0) || 1;
  counts.sort(function (a, b) { return b.n - a.n; });
  counts.forEach(function (entry) {
    var row = document.createElement('div');
    row.className = 'bar-row';

    var name = document.createElement('span');
    name.className = 'bar-name';
    var dot = document.createElement('span');
    dot.className = 'carnet-dot';
    dot.style.background = entry.carnet.couleur || CARNET_COLORS[0];
    var txt = document.createElement('span');
    txt.textContent = entry.carnet.nom;
    name.appendChild(dot);
    name.appendChild(txt);

    var track = document.createElement('div');
    track.className = 'bar-track';
    var fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = Math.round((entry.n / maxC) * 100) + '%';
    fill.style.background = entry.carnet.couleur || CARNET_COLORS[0];
    track.appendChild(fill);

    var count = document.createElement('span');
    count.className = 'bar-count';
    count.textContent = String(entry.n);

    row.appendChild(name);
    row.appendChild(track);
    row.appendChild(count);
    byCarnetEl.appendChild(row);
  });

  /* Par jour de la semaine — 7 barres CSS */
  byWeekdayEl.innerHTML = '';
  var weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // lun..dim
  state.pages.forEach(function (p) {
    var d = fromISO(p.dateISO);
    if (isNaN(d.getTime())) return;
    var dow = (d.getDay() + 6) % 7;
    weekdayCounts[dow] += 1;
  });
  var maxW = weekdayCounts.reduce(function (m, x) { return Math.max(m, x); }, 0);
  var labels = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  weekdayCounts.forEach(function (n, i) {
    var col = document.createElement('div');
    col.className = 'wd-col';
    var bar = document.createElement('div');
    bar.className = 'wd-bar' + (maxW > 0 && n === maxW ? ' wd-bar--peak' : '');
    var h = maxW > 0 ? Math.max(2, Math.round((n / maxW) * 100)) : 2;
    bar.style.height = h + '%';
    bar.title = labels[i] + ' — ' + n + ' page' + (n > 1 ? 's' : '');
    var lab = document.createElement('span');
    lab.className = 'wd-label';
    lab.textContent = labels[i];
    col.appendChild(bar);
    col.appendChild(lab);
    byWeekdayEl.appendChild(col);
  });
}

/* ============================================================
   Export / import JSON versionnés
   ============================================================ */
function exportJSON() {
  var payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    carnets: state.carnets,
    questions: state.questions,
    pages: state.pages,
    prefs: state.prefs
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'meridien-export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  flashFeedback(exportFeedback, EXPORT_FEEDBACK);
}

exportBtn.addEventListener('click', exportJSON);
importBtn.addEventListener('click', function () { importFile.click(); });

function sanitizeImport(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.version !== 2) return null;
  if (!Array.isArray(obj.carnets) || !Array.isArray(obj.questions) || !Array.isArray(obj.pages)) return null;

  var carnets = obj.carnets.filter(function (c) {
    return c && typeof c === 'object' && typeof c.id === 'string' && typeof c.nom === 'string' && c.nom.trim();
  }).map(function (c) {
    return {
      id: c.id,
      nom: String(c.nom).trim(),
      couleur: (typeof c.couleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.couleur)) ? c.couleur : CARNET_COLORS[0],
      questionId: (typeof c.questionId === 'string') ? c.questionId : 'q1',
      rotation: !!c.rotation
    };
  });

  var questions = obj.questions.filter(function (q) {
    return q && typeof q === 'object' && typeof q.id === 'string' && typeof q.texte === 'string' && q.texte.trim();
  }).map(function (q) {
    return { id: q.id, texte: String(q.texte).trim(), custom: !!q.custom };
  });

  var pages = obj.pages.filter(function (p) {
    return p && typeof p === 'object' &&
      typeof p.carnetId === 'string' &&
      typeof p.dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dateISO) &&
      typeof p.texte === 'string';
  }).map(function (p) {
    return {
      id: (typeof p.id === 'string' && p.id) ? p.id : uid(),
      carnetId: p.carnetId,
      dateISO: p.dateISO,
      texte: p.texte,
      tags: Array.isArray(p.tags) ? p.tags.filter(function (t) { return typeof t === 'string'; }) : [],
      question: (typeof p.question === 'string' && p.question) ? p.question : DEFAULT_QUESTIONS[0],
      seed: (typeof p.seed === 'number' && isFinite(p.seed)) ? (p.seed >>> 0) : fnv1a(p.dateISO + p.texte)
    };
  });

  if (!carnets.length) return null;

  var prefs = (obj.prefs && typeof obj.prefs === 'object') ? obj.prefs : {};
  return { version: 2, carnets: carnets, questions: questions, pages: pages, prefs: prefs };
}

function applyImport(data, mode) {
  if (mode === 'replace') {
    state.carnets = data.carnets;
    state.questions = data.questions.length ? data.questions : state.questions;
    state.pages = data.pages;
    state.prefs = {
      theme: (data.prefs && data.prefs.theme === 'night') ? 'night' : 'day',
      activeCarnet: (data.prefs && data.prefs.activeCarnet && carnetByIdIn(data.carnets, data.prefs.activeCarnet)) ? data.prefs.activeCarnet : data.carnets[0].id,
      onboarded: true,
      cloudSalt: (data.prefs && typeof data.prefs.cloudSalt === 'string') ? data.prefs.cloudSalt : state.prefs.cloudSalt
    };
  } else { /* merge */
    var carnetIds = {};
    state.carnets.forEach(function (c) { carnetIds[c.id] = true; });
    data.carnets.forEach(function (c) {
      if (!carnetIds[c.id]) { state.carnets.push(c); carnetIds[c.id] = true; }
    });
    var qIds = {};
    state.questions.forEach(function (q) { qIds[q.id] = true; });
    data.questions.forEach(function (q) {
      if (!qIds[q.id]) { state.questions.push(q); qIds[q.id] = true; }
    });
    var pageIds = {};
    var pageKeys = {};
    state.pages.forEach(function (p) { pageIds[p.id] = true; pageKeys[p.carnetId + '|' + p.dateISO] = true; });
    var validCarnets = {};
    state.carnets.forEach(function (c) { validCarnets[c.id] = true; });
    data.pages.forEach(function (p) {
      if (!validCarnets[p.carnetId]) return; // carnet introuvable même après fusion : ignorée
      if (pageIds[p.id] || pageKeys[p.carnetId + '|' + p.dateISO]) return;
      state.pages.push(p);
      pageIds[p.id] = true;
      pageKeys[p.carnetId + '|' + p.dateISO] = true;
    });
    state.prefs.onboarded = true;
    if (!carnetById(state.prefs.activeCarnet)) state.prefs.activeCarnet = state.carnets[0].id;
  }
  saveCarnets();
  saveQuestions();
  savePages();
  savePrefs();
  applyTheme(state.prefs.theme);
  renderCarnetTabs();
  setRoute(currentRoute());
  buildPrintLog();
  showToast('Archive restaurée — ' + state.pages.length + ' pages.');
}

function carnetByIdIn(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

importFile.addEventListener('change', function () {
  var file = importFile.files && importFile.files[0];
  importFile.value = '';
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var data = null;
    try { data = sanitizeImport(JSON.parse(String(reader.result || ''))); } catch (e) { data = null; }
    if (!data) { showToast(IMPORT_INVALID); return; }
    state.pendingImport = data;
    importModalSub.textContent = 'Archive v2 — ' + data.carnets.length + ' carnet(s), ' + data.questions.length + ' question(s), ' + data.pages.length + ' page(s). Remplacer les données actuelles par l’archive ?';
    openOverlay(importModal);
  };
  reader.onerror = function () { showToast(IMPORT_INVALID); };
  reader.readAsText(file);
});

importModalCancel.addEventListener('click', function () {
  state.pendingImport = null;
  closeOverlay(importModal);
});
importModalMerge.addEventListener('click', function () {
  var data = state.pendingImport;
  state.pendingImport = null;
  closeOverlay(importModal);
  if (data) applyImport(data, 'merge');
});
importModalReplace.addEventListener('click', function () {
  var data = state.pendingImport;
  state.pendingImport = null;
  closeOverlay(importModal);
  if (data) applyImport(data, 'replace');
});

/* ============================================================
   Sauvegarde cloud — WebCrypto, AES-GCM 256, PBKDF2 (150k, SHA-256)
   Le payload est chiffré sur cet appareil ; le serveur ne voit jamais le clair.
   ============================================================ */
var CLOUD_API = '/api/backup';

function bytesToB64(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64) {
  var s = atob(b64);
  var bytes = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function cloudSaltBytes() {
  if (state.prefs.cloudSalt) {
    try {
      var existing = b64ToBytes(state.prefs.cloudSalt);
      if (existing.length >= 16) return existing;
    } catch (e) { /* sel illisible : on en régénère un */ }
  }
  var salt = crypto.getRandomValues(new Uint8Array(16));
  state.prefs.cloudSalt = bytesToB64(salt);
  savePrefs();
  return salt;
}

async function cloudDeriveKey(passphrase, salt) {
  var baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function cloudPassphraseValue() {
  return cloudPassphrase ? cloudPassphrase.value.trim() : '';
}

function cloudCryptoReady() {
  return !!(window.crypto && crypto.subtle && encoder && typeof TextDecoder !== 'undefined');
}

async function cloudSave() {
  var pass = cloudPassphraseValue();
  if (!pass) { showToast('Choisissez d’abord une passphrase.'); return; }
  if (!cloudCryptoReady()) { showToast('WebCrypto indisponible — HTTPS requis.'); return; }
  try {
    var salt = cloudSaltBytes();
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await cloudDeriveKey(pass, salt);
    var payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      carnets: state.carnets,
      questions: state.questions,
      pages: state.pages,
      prefs: state.prefs
    };
    var ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(JSON.stringify(payload))
    );
    /* Le sel voyage avec le blob (il n’est pas secret) : la restauration
       fonctionne même sur un appareil vierge. meridien.prefs.cloudSalt le reflète. */
    var envelope = JSON.stringify({
      v: 2,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      data: bytesToB64(new Uint8Array(ct))
    });
    var res = await fetch(CLOUD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: bytesToB64(encoder.encode(envelope)) })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('Sauvegarde chiffrée envoyée.');
    if (cloudFeedback) flashFeedback(cloudFeedback, 'Sauvegarde chiffrée envoyée.');
  } catch (e) {
    showToast('Sauvegarde impossible — vérifiez la connexion.');
  }
}

async function cloudRestore() {
  var pass = cloudPassphraseValue();
  if (!pass) { showToast('Choisissez d’abord une passphrase.'); return; }
  if (!cloudCryptoReady()) { showToast('WebCrypto indisponible — HTTPS requis.'); return; }
  try {
    var res = await fetch(CLOUD_API, { method: 'GET' });
    if (res.status === 404) { showToast('Aucune sauvegarde'); return; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var buf = new Uint8Array(await res.arrayBuffer());
    var envelope = null;
    try { envelope = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { envelope = null; }
    if (!envelope || !envelope.salt || !envelope.iv || !envelope.data) {
      showToast('Déchiffrement impossible — mauvaise passphrase ?');
      return;
    }
    var salt, iv, data;
    try {
      salt = b64ToBytes(envelope.salt);
      iv = b64ToBytes(envelope.iv);
      data = b64ToBytes(envelope.data);
    } catch (e) {
      showToast('Déchiffrement impossible — mauvaise passphrase ?');
      return;
    }
    var key = await cloudDeriveKey(pass, salt);
    var plain;
    try {
      plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    } catch (e) {
      showToast('Déchiffrement impossible — mauvaise passphrase ?');
      return;
    }
    var parsed;
    try { parsed = JSON.parse(new TextDecoder().decode(plain)); } catch (e) { parsed = null; }
    var clean = parsed ? sanitizeImport(parsed) : null;
    if (!clean) { showToast(IMPORT_INVALID); return; }
    state.prefs.cloudSalt = envelope.salt;
    pendingCloudImport = clean;
    if (restoreModalSub) {
      restoreModalSub.textContent = 'Archive v2 — ' + clean.carnets.length + ' carnet(s), ' + clean.questions.length + ' question(s), ' + clean.pages.length + ' page(s). Remplacer les données actuelles ?';
    }
    openOverlay(restoreModal);
  } catch (e) {
    showToast('Restauration impossible — vérifiez la connexion.');
  }
}

if (cloudSaveBtn) cloudSaveBtn.addEventListener('click', cloudSave);
if (cloudRestoreBtn) cloudRestoreBtn.addEventListener('click', cloudRestore);
if (restoreModalCancel) restoreModalCancel.addEventListener('click', function () {
  pendingCloudImport = null;
  closeOverlay(restoreModal);
});
if (restoreModalReplace) restoreModalReplace.addEventListener('click', function () {
  var data = pendingCloudImport;
  pendingCloudImport = null;
  closeOverlay(restoreModal);
  if (data) {
    applyImport(data, 'replace');
    showToast('Archive restaurée depuis le cloud — ' + state.pages.length + ' pages.');
  }
});
if (cloudPassphrase) {
  try { cloudPassphrase.value = localStorage.getItem(K_CLOUD) || ''; } catch (e) { /* stockage indisponible */ }
  cloudPassphrase.addEventListener('input', function () {
    try { localStorage.setItem(K_CLOUD, cloudPassphrase.value); } catch (e) { /* stockage indisponible */ }
  });
}

/* ============================================================
   Recherche plein texte — /
   ============================================================ */
function highlight(text, q) {
  var safe = esc(text);
  if (!q) return safe;
  var tokens = String(q).trim().split(/\s+/).filter(Boolean).map(function (t) { return escapeRegExp(esc(t)); });
  if (!tokens.length) return safe;
  var re = new RegExp('(' + tokens.join('|') + ')', 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function searchPages(rawQuery) {
  var q = fold(String(rawQuery || '').trim());
  if (!q) return [];
  var tokens = q.split(/\s+/).filter(Boolean);
  var hits = [];
  state.pages.forEach(function (p) {
    var hay = fold((p.texte || '') + '\n' + tagsOf(p).join(' ') + '\n' + (p.question || ''));
    var ok = tokens.every(function (tok) { return hay.indexOf(tok) !== -1; });
    if (ok) hits.push(p);
  });
  hits.sort(function (a, b) { return a.dateISO < b.dateISO ? 1 : -1; });
  return hits.slice(0, 30);
}

function renderSearchResults() {
  var q = searchInput.value.trim();
  state.searchResults = searchPages(q);
  state.searchIndex = 0;

  searchResults.innerHTML = '';
  searchEmpty.hidden = !(q && state.searchResults.length === 0);
  searchMeta.textContent = q
    ? state.searchResults.length + ' page' + (state.searchResults.length > 1 ? 's' : '') + ' pour « ' + q + ' »'
    : '';

  state.searchResults.forEach(function (p, i) {
    var li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'result-item' + (i === state.searchIndex ? ' is-active' : '');
    btn.setAttribute('role', 'option');
    btn.id = 'search-item-' + i;
    var carnet = carnetById(p.carnetId);
    var snippet = (p.texte || '').replace(/\s+/g, ' ').trim();
    if (snippet.length > 140) snippet = snippet.slice(0, 140) + '…';
    btn.innerHTML =
      '<span class="result-item-head"><span>' + esc(frenchCaps(p.dateISO)) + '</span><span>' + esc(carnet ? carnet.nom : '') + '</span></span>' +
      '<span class="result-snippet">' + highlight(snippet, q) + '</span>';
    btn.addEventListener('click', function () {
      closeOverlay(searchOverlay);
      openPageDetail(p, null);
    });
    li.appendChild(btn);
    searchResults.appendChild(li);
  });
}

function updateSearchActive() {
  Array.prototype.forEach.call(searchResults.children, function (li, i) {
    var btn = li.querySelector('.result-item');
    if (btn) btn.classList.toggle('is-active', i === state.searchIndex);
  });
}

function openSearch() {
  state.searchTrigger = document.activeElement;
  openOverlay(searchOverlay);
  searchInput.value = '';
  renderSearchResults();
  setTimeout(function () { searchInput.focus(); }, 0);
}

searchInput.addEventListener('input', renderSearchResults);
searchInput.addEventListener('keydown', function (e) {
  var n = state.searchResults.length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); state.searchIndex = (state.searchIndex + 1) % n; updateSearchActive(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); state.searchIndex = (state.searchIndex - 1 + n) % n; updateSearchActive(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    var p = state.searchResults[state.searchIndex];
    if (p) { closeOverlay(searchOverlay); openPageDetail(p, null); }
  }
});
searchOverlay.addEventListener('click', function (e) {
  if (e.target === searchOverlay) closeOverlay(searchOverlay);
});

/* ============================================================
   Command palette — Cmd/Ctrl+K
   ============================================================ */
var PALETTE_ACTIONS = [
  { id: 'new-page',      label: 'Nouvelle page',        hint: '1' },
  { id: 'carnet',        label: 'Changer de carnet…',   hint: '' },
  { id: 'new-carnet',    label: 'Nouveau carnet',       hint: 'N' },
  { id: 'goto',          label: 'Aller à la date…',     hint: '' },
  { id: 'toggle-theme',  label: 'Basculer Encre de nuit', hint: '⌘⇧D' },
  { id: 'export',        label: 'Exporter l’archive',   hint: 'E' },
  { id: 'import',        label: 'Importer une archive', hint: '' },
  { id: 'search',        label: 'Chercher…',            hint: '/' },
  { id: 'annee',         label: 'Voir l’année…',        hint: '4' }
];

function paletteItems() {
  var q = fold(paletteInput.value.trim());
  if (state.paletteMode === 'carnet') {
    return state.carnets
      .filter(function (c) { return !q || fold(c.nom).indexOf(q) !== -1; })
      .map(function (c) { return { id: 'carnet:' + c.id, label: c.nom, hint: 'carnet' }; });
  }
  if (state.paletteMode === 'date' || state.paletteMode === 'new-carnet') return [];
  return PALETTE_ACTIONS.filter(function (a) { return !q || fold(a.label).indexOf(q) !== -1; });
}

function renderPalette() {
  var items = paletteItems();
  if (state.paletteIndex >= items.length) state.paletteIndex = Math.max(0, items.length - 1);
  paletteList.innerHTML = '';
  items.forEach(function (item, i) {
    var li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'result-item' + (i === state.paletteIndex ? ' is-active' : '');
    btn.setAttribute('role', 'option');
    btn.id = 'palette-item-' + i;
    btn.innerHTML = '<span class="palette-item-label"><span>' + esc(item.label) + '</span>' +
      (item.hint ? '<span class="palette-item-hint">' + esc(item.hint) + '</span>' : '') + '</span>';
    btn.addEventListener('click', function () {
      state.paletteIndex = i;
      executePaletteItem(item);
    });
    li.appendChild(btn);
    paletteList.appendChild(li);
  });
  paletteInput.setAttribute('aria-activedescendant', items.length ? 'palette-item-' + state.paletteIndex : '');
}

function setPaletteMode(mode, placeholder) {
  state.paletteMode = mode;
  state.paletteIndex = 0;
  paletteInput.value = '';
  paletteInput.placeholder = placeholder || 'Que voulez-vous faire ?';
  renderPalette();
}

var MONTHS_FR = {
  'janvier': 1, 'fevrier': 2, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'aout': 8, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'decembre': 12, 'décembre': 12,
  'janv': 1, 'fevr': 2, 'févr': 2, 'sept': 9, 'dec': 12, 'déc': 12
};

function parseGotoDate(raw) {
  var s = String(raw || '').trim().toLowerCase();
  var m;
  m = s.match(/^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?$/);
  if (m) {
    var day = Number(m[1]);
    var month = Number(m[2]);
    var year = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return toISO(new Date(year, month - 1, day));
    }
    return null;
  }
  m = s.match(/^(\d{1,2})\s+([a-zéûç]+)\.?(?:\s+(\d{2,4}))?$/);
  if (m) {
    var d2 = Number(m[1]);
    var monName = m[2].replace(/\.$/, '');
    var mon = MONTHS_FR[monName];
    if (!mon) mon = MONTHS_FR[fold(monName)];
    var y2 = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y2 < 100) y2 += 2000;
    if (mon && d2 >= 1 && d2 <= 31) return toISO(new Date(y2, mon - 1, d2));
  }
  return null;
}

function executePaletteItem(item) {
  if (!item) return;
  var id = item.id;

  if (id.indexOf('carnet:') === 0) {
    var cid = id.slice('carnet:'.length);
    closeOverlay(palette);
    setActiveCarnet(cid);
    return;
  }

  switch (id) {
    case 'new-page':
      closeOverlay(palette);
      navigate('/');
      setTimeout(function () { try { entryEl.focus({ preventScroll: true }); } catch (e) { entryEl.focus(); } }, 50);
      break;
    case 'carnet':
      setPaletteMode('carnet', 'Changer de carnet…');
      break;
    case 'new-carnet':
      setPaletteMode('new-carnet', 'Nom du carnet…');
      break;
    case 'goto':
      setPaletteMode('date', 'JJ/MM ou « 14 novembre »');
      break;
    case 'toggle-theme':
      closeOverlay(palette);
      toggleTheme();
      break;
    case 'export':
      closeOverlay(palette);
      exportJSON();
      break;
    case 'import':
      closeOverlay(palette);
      importFile.click();
      break;
    case 'search':
      closeOverlay(palette);
      openSearch();
      break;
    case 'annee':
      closeOverlay(palette);
      navigate('/annee');
      break;
    default:
      closeOverlay(palette);
  }
}

function openPalette() {
  state.paletteTrigger = document.activeElement;
  openOverlay(palette);
  setPaletteMode('actions', 'Que voulez-vous faire ?');
  setTimeout(function () { paletteInput.focus(); }, 0);
}

paletteInput.addEventListener('input', function () {
  state.paletteIndex = 0;
  renderPalette();
});

paletteInput.addEventListener('keydown', function (e) {
  var items = paletteItems();

  /* Sous-modes : pas de liste, Enter valide la saisie */
  if (state.paletteMode === 'date') {
    if (e.key === 'Enter') {
      e.preventDefault();
      var iso = parseGotoDate(paletteInput.value);
      if (!iso) { showToast('Date non reconnue — essayez « 14/11 » ou « 14 novembre ».'); return; }
      closeOverlay(palette);
      var d = fromISO(iso);
      state.viewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      navigate('/archive');
      openDetailForDate(iso);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPaletteMode('actions', 'Que voulez-vous faire ?'); return; }
    return;
  }
  if (state.paletteMode === 'new-carnet') {
    if (e.key === 'Enter') {
      e.preventDefault();
      var name = paletteInput.value.trim();
      closeOverlay(palette);
      if (name) createCarnet(name);
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPaletteMode('actions', 'Que voulez-vous faire ?'); return; }
    return;
  }

  /* Mode liste */
  if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); state.paletteIndex = (state.paletteIndex + 1) % items.length; renderPalette(); }
  else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); state.paletteIndex = (state.paletteIndex - 1 + items.length) % items.length; renderPalette(); }
  else if (e.key === 'Enter') { e.preventDefault(); executePaletteItem(items[state.paletteIndex]); }
  else if (e.key === 'Backspace' && paletteInput.value === '' && state.paletteMode === 'carnet') {
    e.preventDefault();
    setPaletteMode('actions', 'Que voulez-vous faire ?');
  }
});

palette.addEventListener('click', function (e) {
  if (e.target === palette) closeOverlay(palette);
});

/* ============================================================
   Clavier global
   ============================================================ */
function anyOverlayOpen() { return openOverlays.length > 0; }

document.addEventListener('keydown', function (e) {
  var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  var inField = (tag === 'textarea' || tag === 'input' || (e.target && e.target.isContentEditable));
  var mod = e.metaKey || e.ctrlKey;

  /* Cmd/Ctrl+K — palette, depuis n'importe où */
  if (mod && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    if (!palette.hidden) closeOverlay(palette);
    else openPalette();
    return;
  }

  /* Cmd/Ctrl+Shift+D — Encre de nuit */
  if (mod && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.key === 'É' || e.code === 'KeyD')) {
    e.preventDefault();
    toggleTheme();
    return;
  }

  /* Cmd/Ctrl+Enter — garder la page */
  if (mod && e.key === 'Enter') {
    if (state.route === '/') {
      e.preventDefault();
      saveToday();
    }
    return;
  }

  /* Échap — fermer l'overlay ouvert, sinon retour */
  if (e.key === 'Escape') {
    if (restoreModal && !restoreModal.hidden) { closeOverlay(restoreModal); return; }
    if (importModal && !importModal.hidden) { closeOverlay(importModal); return; }
    if (questionModal && !questionModal.hidden) { closeOverlay(questionModal); return; }
    if (carnetModal && !carnetModal.hidden) { closeOverlay(carnetModal); return; }
    if (deleteModal && !deleteModal.hidden) { closeOverlay(deleteModal); return; }
    if (searchOverlay && !searchOverlay.hidden) { closeOverlay(searchOverlay); return; }
    if (palette && !palette.hidden) { closeOverlay(palette); return; }
    if (detailOverlay && !detailOverlay.hidden) { closeOverlay(detailOverlay); return; }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (state.route !== '/') navigate('/');
    return;
  }

  /* Tab — confiné dans l'overlay modal ouvert */
  if (e.key === 'Tab' && anyOverlayOpen()) {
    trapTab(openOverlays[openOverlays.length - 1], e);
    return;
  }

  if (inField) return;

  if (e.key === '1') { e.preventDefault(); navigate('/'); return; }
  if (e.key === '2') { e.preventDefault(); navigate('/archive'); return; }
  if (e.key === '3') { e.preventDefault(); navigate('/stats'); return; }
  if (e.key === '4') { e.preventDefault(); navigate('/annee'); return; }

  if (e.key === '/') {
    e.preventDefault();
    if (searchOverlay.hidden) openSearch(); else closeOverlay(searchOverlay);
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openCarnetModal('create');
    return;
  }

  if (state.route === '/archive' && detailOverlay.hidden) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); changeMonth(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); changeMonth(1); }
    return;
  }

  if (state.route === '/stats' && (e.key === 'e' || e.key === 'E')) {
    e.preventDefault();
    exportJSON();
  }
});

/* ============================================================
   Onboarding — 3 écrans, jamais affiché deux fois
   ============================================================ */
var obScreens = [
  document.getElementById('ob-screen-1'),
  document.getElementById('ob-screen-2'),
  document.getElementById('ob-screen-3')
];

function showObScreen(n) {
  obScreens.forEach(function (s, i) { if (s) s.hidden = (i !== n - 1); });
  if (n === 2) {
    var input = document.getElementById('ob-carnet-name');
    if (input) setTimeout(function () { input.focus(); input.select(); }, 0);
  }
}

Array.prototype.forEach.call(document.querySelectorAll('[data-ob-next]'), function (btn) {
  btn.addEventListener('click', function () {
    var target = Number(btn.getAttribute('data-ob-next')) || 1;
    showObScreen(target);
  });
});

var obCreate = document.getElementById('ob-create-carnet');
if (obCreate) {
  obCreate.addEventListener('click', function () {
    var input = document.getElementById('ob-carnet-name');
    var name = input && input.value.trim() ? input.value.trim() : 'Intention';
    createCarnet(name); // réutilise un carnet existant du même nom
    showObScreen(3);
  });
}

var obFinish = document.getElementById('ob-finish');
if (obFinish) {
  obFinish.addEventListener('click', function () {
    state.prefs.onboarded = true;
    savePrefs();
    navigate('/');
    setTimeout(function () { try { entryEl.focus({ preventScroll: true }); } catch (e) { entryEl.focus(); } }, 60);
  });
}

/* ============================================================
   Bouton thème
   ============================================================ */
var themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

/* ============================================================
   Journal imprimable — une page = un jour
   ============================================================ */
function buildPrintLog() {
  if (!printLog) return;
  printLog.innerHTML = '';
  var sorted = state.pages.slice().sort(function (a, b) { return a.dateISO < b.dateISO ? -1 : 1; });
  sorted.forEach(function (p) {
    var carnet = carnetById(p.carnetId);
    var section = document.createElement('article');
    section.className = 'print-page';

    var head = document.createElement('div');
    head.className = 'print-head';
    var left = document.createElement('span');
    left.textContent = carnet ? carnet.nom : 'Méridien';
    var right = document.createElement('span');
    right.textContent = frenchLong(p.dateISO);
    head.appendChild(left);
    head.appendChild(right);

    var q = document.createElement('p');
    q.className = 'print-question';
    q.textContent = p.question || DEFAULT_QUESTIONS[0];

    var body = document.createElement('p');
    body.className = 'print-text';
    body.textContent = p.texte || '';

    section.appendChild(head);
    section.appendChild(q);
    section.appendChild(body);

    var tags = tagsOf(p);
    if (tags.length) {
      var t = document.createElement('p');
      t.className = 'print-tags';
      t.textContent = tags.map(function (x) { return '#' + x; }).join('  ');
      section.appendChild(t);
    }

    printLog.appendChild(section);
  });
}

window.addEventListener('beforeprint', buildPrintLog);

/* ============================================================
   Init
   ============================================================ */
loadAll();
migrateV1();
seedDefaultQuestions();

/* Garantir un carnet actif si déjà onboardé */
if (state.prefs.onboarded || state.carnets.length) ensureActiveCarnet();

applyTheme(state.prefs.theme);
renderCarnetTabs();
buildPrintLog();

if (!state.prefs.onboarded && !window.location.hash.replace(/^#/, '').match(/^\/bienvenue$/)) {
  window.location.hash = '#/bienvenue';
}
showObScreen(1);
setRoute(currentRoute());

window.addEventListener('load', function () {
  if (currentRoute() === '/') {
    try { entryEl.focus({ preventScroll: true }); } catch (e) { entryEl.focus(); }
  }
  autosize();
});

/* Skip-link : intercepter pour ne pas casser le routeur hash */
var skipLink = document.querySelector('.skip-link');
if (skipLink) skipLink.addEventListener('click', function (e) {
  e.preventDefault();
  if (currentRoute() !== '/') navigate('/');
  try { entryEl.focus({ preventScroll: true }); } catch (err) { entryEl.focus(); }
});
