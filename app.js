/* Mat Daily: workout builder, guided player and tracker. Data stays in this browser (localStorage). */
(function () {
  'use strict';
  var MD = window.MD, EX = MD.EX;

  // ---------- constants ----------
  var FOCUS = [
    { k: 'abs', label: 'Abs', c: 'var(--c-abs)' },
    { k: 'arms', label: 'Arms', c: 'var(--c-arms)' },
    { k: 'legs', label: 'Legs & glutes', c: 'var(--c-legs)' },
    { k: 'full', label: 'Full body', c: 'var(--ink)' }
  ];
  var TIMES = [15, 20, 30, 45, 60];
  var LEVELS = [
    { label: 'Gentle', work: 35, rest: 25, note: 'slower, longer rests' },
    { label: 'Steady', work: 45, rest: 15, note: 'a solid class pace' },
    { label: 'Strong', work: 50, rest: 10, note: 'short rests, harder variations' }
  ];
  var POS = { supine: 0, seated: 1, side: 2, prone: 3, quad: 4, standing: 5 };
  var KEY = 'matdaily.v1';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------- helpers ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  var parseYmd = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var todayStr = function () { return ymd(new Date()); };
  var dayDiff = function (a, b) { return Math.round((parseYmd(a) - parseYmd(b)) / 864e5); };
  var fmtShort = function (s) { var d = parseYmd(s); return DAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var focusLabel = function (keys) {
    return keys.map(function (k) { return FOCUS.filter(function (f) { return f.k === k; })[0].label; }).join(' + ');
  };
  var minsLabel = function (sec) { return Math.round(sec / 60) + ' min'; };

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- storage ----------
  var mem = null;
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var s = JSON.parse(raw); if (s && Array.isArray(s.log)) return s; } } catch (e) { /* storage blocked */ }
    return mem || { log: [], prefs: {}, shuffle: 0 };
  }
  var state = load();
  state.prefs = state.prefs || {};
  function save() { mem = state; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- log helpers ----------
  function groupsOf(keys) {
    var out = {};
    keys.forEach(function (k) { if (k === 'full') { out.abs = out.arms = out.legs = 1; } else out[k] = 1; });
    return out;
  }
  function daysSinceByGroup() {
    var res = { abs: Infinity, arms: Infinity, legs: Infinity }, t = todayStr();
    state.log.forEach(function (e) {
      var d = dayDiff(t, e.date);
      Object.keys(groupsOf(e.focus)).forEach(function (g) { if (d >= 0 && d < res[g]) res[g] = d; });
    });
    return res;
  }

  // ---------- suggestion ----------
  function suggest() {
    var ds = daysSinceByGroup(), t = todayStr();
    var never = ds.abs === Infinity && ds.arms === Infinity && ds.legs === Infinity;
    var focus, why;
    var recent = state.log.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (never) {
      var wd = new Date().getDay();
      var rota = { 1: ['arms', 'abs'], 2: ['legs'], 3: ['full'], 4: ['abs', 'arms'], 5: ['legs'], 6: ['full'], 0: ['abs'] };
      focus = rota[wd];
      why = 'A rotating week keeps every area fresh: arms and abs, then legs, then full body.';
    } else {
      var upper = Math.min(ds.arms, ds.abs);
      if (ds.legs >= upper) {
        focus = ['legs'];
        why = ds.legs === Infinity ? 'You have not logged a leg day yet.' : 'Legs were last trained ' + (ds.legs === 0 ? 'today' : ds.legs + (ds.legs === 1 ? ' day' : ' days') + ' ago') + '.';
      } else {
        focus = ds.arms >= ds.abs ? ['arms', 'abs'] : ['abs', 'arms'];
        why = 'Arms and abs were last trained ' + (upper === 0 ? 'today' : upper + (upper === 1 ? ' day' : ' days') + ' ago') + ', so legs are fresher. Upper body and core are due next.';
        if (upper > ds.legs) why = 'Legs were trained ' + (ds.legs === 0 ? 'today' : ds.legs + (ds.legs === 1 ? ' day' : ' days') + ' ago') + ', so arms and abs are next.';
      }
    }
    var lvl = state.prefs.level === undefined ? 1 : state.prefs.level;
    var last2 = recent.slice(0, 2);
    var hint = '';
    if (last2.length === 2 && last2.every(function (e) { return e.feel === 'easy'; }) && lvl < 2) { hint = ' Your last two sessions felt easy, so try ' + LEVELS[lvl + 1].label + '.'; }
    if (last2.length === 2 && last2.every(function (e) { return e.feel === 'hard'; }) && lvl > 0) { hint = ' Your last two sessions felt hard, so ' + LEVELS[lvl - 1].label + ' might feel better.'; }
    var doneToday = recent.some(function (e) { return e.date === t; });
    return { focus: focus, why: why + hint, doneToday: doneToday };
  }

  // ---------- workout builder ----------
  function prefs() {
    var p = state.prefs;
    if (!p.focus || !p.focus.length) p.focus = suggest().focus;
    if (!p.minutes) p.minutes = 30;
    if (p.level === undefined) p.level = 1;
    if (p.weights === undefined) p.weights = true;
    if (p.ring === undefined) p.ring = false;
    if (p.roller === undefined) p.roller = false;
    if (p.restSec === undefined) p.restSec = p.rest === false ? 0 : 10;
    if (p.voice === undefined) p.voice = true;
    if (p.music === undefined) p.music = true;
    if (p.beeps === undefined) p.beeps = true;
    return p;
  }

  function build(o) {
    var L = LEVELS[o.level];
    var r = rng(hash([o.focus.slice().sort().join(), o.minutes, o.level, o.weights ? 1 : 0, o.ring ? 1 : 0, o.roller ? 1 : 0, o.restSec, todayStr(), state.shuffle || 0].join('|')));
    var maxLvl = o.level === 0 ? 2 : 3;
    var groups = o.focus.indexOf('full') >= 0 ? ['abs', 'arms', 'legs'] : o.focus.slice();
    var warmN = o.minutes >= 45 ? 4 : o.minutes >= 25 ? 3 : 2;
    var coolN = o.minutes >= 45 ? 3 : 2;
    var used = {};
    var gear = function (e) { return (!e.ring || o.ring) && (!e.roller || o.roller); };
    var gearFirst = function (l) { return (o.ring || o.roller) ? l.sort(function (x, y) { return ((y.ring || y.roller) ? 1 : 0) - ((x.ring || x.roller) ? 1 : 0); }) : l; };
    var restS = o.restSec;

    var coolPool = EX.filter(function (e) { return e.use.indexOf('cool') >= 0 && gear(e); });
    var cool = [BY('child')];
    used.child = 1;
    gearFirst(shuffle(coolPool.filter(function (e) { return !used[e.id]; }), r)).slice(0, coolN - 1).forEach(function (e) { cool.push(e); used[e.id] = 1; });
    cool.sort(function (a, b) { return (a.co === undefined ? 2 : a.co) - (b.co === undefined ? 2 : b.co); });

    var warmPool = EX.filter(function (e) { return e.use.indexOf('warm') >= 0 && !used[e.id] && gear(e); });
    var warm = shuffle(warmPool, r).slice(0, warmN);
    warm.forEach(function (e) { used[e.id] = 1; });
    warm.sort(function (a, b) { return (a.wo === undefined ? 9 : a.wo) - (b.wo === undefined ? 9 : b.wo); });

    var wr = Math.min(restS, 5);
    var warmSec = warm.length * (40 + wr), coolSec = cool.length * (45 + wr);
    var mainSec = Math.max(o.minutes * 60 - warmSec - coolSec, 240);
    var slot = L.work + restS;
    var slots = Math.floor(mainSec / slot);
    var rounds0 = o.minutes <= 20 ? 1 : o.minutes <= 35 ? 2 : 3;
    var target = clamp(Math.round(slots / rounds0), 4, 14);

    var pool = EX.filter(function (e) { return e.use.indexOf('main') >= 0 && e.lvl <= maxLvl && !used[e.id] && gear(e); });
    var lists = {};
    groups.forEach(function (g) {
      var l = shuffle(pool.filter(function (e) { return e.g.indexOf(g) >= 0; }), r);
      if (o.level === 0) l.sort(function (a, b) { return a.lvl - b.lvl; });
      if (o.level === 2) l.sort(function (a, b) { return (b.lvl >= 2 ? 1 : 0) - (a.lvl >= 2 ? 1 : 0); });
      if (!o.weights) l.sort(function (a, b) { return (a.w ? 1 : 0) - (b.w ? 1 : 0); });
      gearFirst(l);
      lists[g] = l;
    });
    var chosen = [], picked = {}, guard = 0;
    while (chosen.length < target && guard++ < 60) {
      var progressed = false;
      for (var gi = 0; gi < groups.length && chosen.length < target; gi++) {
        var l = lists[groups[gi]];
        while (l.length && picked[l[0].id]) l.shift();
        if (l.length) { var e = l.shift(); picked[e.id] = 1; chosen.push(e); progressed = true; }
      }
      if (!progressed) break;
    }
    // Try a few move counts and keep the one whose total lands closest to the requested time.
    var best = null;
    for (var n = chosen.length; n >= Math.max(4, chosen.length - 4); n--) {
      var ratio = mainSec / (n * slot), rr = Math.max(1, Math.floor(ratio));
      if (Math.abs(ratio - (rr + 1)) < Math.abs(ratio - rr)) rr++;
      var err = Math.abs(warmSec + coolSec + rr * n * slot - o.minutes * 60);
      if (!best || err < best.err - 20) best = { n: n, rounds: rr, err: err };
    }
    chosen = chosen.slice(0, best.n).map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return (POS[a.e.pos] - POS[b.e.pos]) || (a.i - b.i); })
      .map(function (x) { return x.e; });
    var rounds = best.rounds;
    var total = warmSec + coolSec + rounds * chosen.length * slot;
    return { o: o, L: L, restS: restS, warm: warm, cool: cool, main: chosen, rounds: rounds, warmSec: warmSec, coolSec: coolSec, total: total };
  }
  function BY(id) { return MD.BY_ID[id]; }

  function dose(ex, work, o) {
    if (ex.kind === 'hold') return { text: work + ' sec', sub: ex.id === 'hundred' ? 'about ' + Math.round(work * 100 / 100) + ' pumps' : 'steady breathing' };
    var per = ex.sides ? work / 2 : work;
    var reps = Math.max(4, Math.round(per / ex.tempo));
    return { text: reps + (ex.sides ? ' each side' : ' reps'), sub: ex.sides ? work + ' sec total' : work + ' sec' };
  }

  // ---------- cards ----------
  function lvlBars(n) { return '<span class="lvl" title="Level ' + n + ' of 3">' + [1, 2, 3].map(function (i) { return '<b class="' + (i <= n ? 'on' : '') + '"></b>'; }).join('') + '</span>'; }
  function groupTags(ex) {
    return ex.g.map(function (g) { var f = FOCUS.filter(function (x) { return x.k === g; })[0]; return '<span class="tag"><i style="background:' + f.c + '"></i>' + f.label + '</span>'; }).join('');
  }
  function card(ex, opts) {
    opts = opts || {};
    var figs = MD.figures(ex);
    var d = opts.work ? dose(ex, opts.work, opts.o) : null;
    var weightNote = ex.w ? (opts.o && !opts.o.weights ? '<span class="tag w">No weights today</span>' : '<span class="tag w">Light weights</span>') : '';
    if (ex.ring) weightNote += '<span class="tag w">Pilates ring</span>';
    if (ex.roller) weightNote += '<span class="tag w">Foam roller</span>';
    return '<article class="card" id="ex-' + ex.id + '">' +
      '<div class="figs"><div><small>Start</small>' + figs[0] + '</div><div><small>Move</small>' + figs[1] + '</div></div>' +
      '<div class="card-body"><div class="card-top"><h3>' + esc(ex.name) + '</h3>' + (d ? '<span class="dose num">' + d.text + '</span>' : '') + '</div>' +
      '<p class="blurb">' + esc(ex.blurb) + '</p>' +
      '<div class="tags">' + groupTags(ex) + weightNote + '<span class="tag">' + lvlBars(ex.lvl) + '</span></div>' +
      '<details' + (opts.open ? ' open' : '') + '><summary>How to do it</summary><div class="how">' +
      '<ol>' + ex.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="cue"><b>Think:</b> ' + ex.cues.map(esc).join(' · ') + '</p>' +
      '<div class="var"><span><b>Easier:</b> ' + esc(ex.easier) + '</span><span><b>Harder:</b> ' + esc(ex.harder) + '</span><span><b>You will feel it in:</b> ' + esc(ex.feel) + '</span></div>' +
      '</div></details></div></article>';
  }

  // ---------- Today view ----------
  var currentPlan = null;
  function chip(label, pressed, attrs, extra) {
    return '<button type="button" class="chip" aria-pressed="' + (pressed ? 'true' : 'false') + '" ' + attrs + '>' + (extra || '') + esc(label) + '</button>';
  }
  function parsePlaylist(s) {
    if (!s) return '';
    var m = s.match(/^spotify:(playlist|album|artist|show):([A-Za-z0-9]+)$/);
    if (m) return 'https://open.spotify.com/' + m[1] + '/' + m[2];
    return /^https:\/\/open\.spotify\.com\/(playlist|album|artist|show)\/[A-Za-z0-9]+/.test(s) ? s : '';
  }
  function renderBuilder() {
    var p = prefs();
    $('#chips-focus').innerHTML = FOCUS.map(function (f) {
      return chip(f.label, p.focus.indexOf(f.k) >= 0, 'data-focus="' + f.k + '"', f.k === 'full' ? '' : '<span class="dot" style="background:' + f.c + '"></span>');
    }).join('');
    $('#chips-time').innerHTML = TIMES.map(function (m) { return chip(m + ' min', p.minutes === m, 'data-time="' + m + '"'); }).join('');
    $('#chips-level').innerHTML = LEVELS.map(function (l, i) { return chip(l.label, p.level === i, 'data-level="' + i + '" title="' + l.note + '"'); }).join('');
    $('#chips-weights').innerHTML = chip('No weights', !p.weights, 'data-weights="0"') + chip('Light weights', p.weights, 'data-weights="1"');
    $('#chips-ring').innerHTML = chip('No ring', !p.ring, 'data-ring="0"') + chip('I have a ring', p.ring, 'data-ring="1"');
    $('#chips-roller').innerHTML = chip('No roller', !p.roller, 'data-roller="0"') + chip('I have a roller', p.roller, 'data-roller="1"');
    renderPhotoRow();
    var pli = $('#pl-input'); if (pli && document.activeElement !== pli) pli.value = p.playlist || '';
    $('#chips-rest').innerHTML = [0, 5, 10, 15, 20, 30].map(function (n) { return chip(n ? n + ' sec' : 'No rest', p.restSec === n, 'data-rest="' + n + '"'); }).join('');
  }

  function renderSuggest() {
    var s = suggest(), p = prefs();
    var same = s.focus.slice().sort().join() === p.focus.slice().sort().join();
    $('#suggest').innerHTML = '<div><p class="eyebrow">' + (s.doneToday ? 'Already trained today. For next time' : 'Suggested for today') + '</p>' +
      '<h2>' + esc(focusLabel(s.focus)) + '</h2><p>' + esc(s.why) + '</p></div>' +
      (same ? '' : '<button type="button" class="btn" data-act="use-suggest">Use this focus</button>');
  }

  function renderPlan() {
    var p = prefs();
    var plan = currentPlan = build(p);
    var L = plan.L;
    var warmHtml = plan.warm.map(function (e) { return card(e, { work: 40, o: p }); }).join('');
    var mainHtml = plan.main.map(function (e) { return card(e, { work: L.work, o: p }); }).join('');
    var coolHtml = plan.cool.map(function (e) { return card(e, { work: 45, o: p }); }).join('');
    var rounds = plan.rounds;
    $('#plan').innerHTML =
      '<div class="plan-head"><div><p class="eyebrow">Your workout</p><h2>' + esc(focusLabel(p.focus)) + ' · ' + p.minutes + ' min · ' + L.label + '</h2>' +
      '<div class="plan-meta num"><span><b>' + (plan.warm.length + plan.main.length + plan.cool.length) + '</b> moves</span>' +
      '<span><b>' + plan.main.length + '</b> moves × <b>' + rounds + '</b> ' + (rounds === 1 ? 'round' : 'rounds') + '</span>' +
      '<span><b>' + L.work + '</b> sec work' + (plan.restS ? ' / <b>' + plan.restS + '</b> sec rest' : ', no rest between moves') + '</span>' +
      '<span>About <b>' + minsLabel(plan.total) + '</b></span></div></div>' +
      '<div class="plan-actions"><button type="button" class="btn" data-act="start">Start guided workout</button>' +
      '<button type="button" class="btn ghost" data-act="shuffle">Shuffle moves</button>' +
      '<button type="button" class="btn ghost" data-act="quicklog">I did this one</button>' +
      (p.playlist ? '<a class="btn ghost" href="' + esc(p.playlist) + '" target="_blank" rel="noopener">Open Spotify</a>' : '') + '</div></div>' +
      (p.playlist ? '<p class="muted">Tip: start your playlist in Spotify first, then come back here and tap Start. Keep the app Music button off in the workout.</p>' : '') +
      '<div class="sec"><div class="sec-head"><h3>Warm-up</h3><span>' + minsLabel(plan.warmSec) + '</span></div><div class="cards">' + warmHtml + '</div></div>' +
      '<div class="sec"><div class="sec-head"><h3>Main set</h3><span>' + minsLabel(plan.main.length * (L.work + plan.restS) * rounds) + '</span></div>' +
      (rounds > 1 ? '<p class="round-banner">Do these ' + plan.main.length + ' moves in order, then repeat the whole set ' + (rounds - 1) + (rounds === 2 ? ' more time' : ' more times') + '. Second and third rounds: reach a little further or add the harder option.</p>' : '') +
      '<div class="cards">' + mainHtml + '</div></div>' +
      '<div class="sec"><div class="sec-head"><h3>Cool-down</h3><span>' + minsLabel(plan.coolSec) + '</span></div><div class="cards">' + coolHtml + '</div></div>';
  }

  function renderToday() {
    var d = new Date();
    $('#today-date').textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    renderSuggest(); renderBuilder(); renderPlan();
  }

  // ---------- Library ----------
  var libFilter = 'all';
  function renderLibrary() {
    var filters = [['all', 'All moves'], ['abs', 'Abs'], ['arms', 'Arms'], ['legs', 'Legs & glutes'], ['weights', 'With weights'], ['ring', 'Pilates ring'], ['roller', 'Foam roller'], ['stretch', 'Warm-up & cool-down']];
    $('#lib-filters').innerHTML = filters.map(function (f) { return chip(f[1], libFilter === f[0], 'data-lib="' + f[0] + '"'); }).join('');
    var list = EX.filter(function (e) {
      if (libFilter === 'all') return true;
      if (libFilter === 'weights') return !!e.w;
      if (libFilter === 'ring') return !!e.ring;
      if (libFilter === 'roller') return !!e.roller;
      if (libFilter === 'stretch') return e.use.indexOf('warm') >= 0 || e.use.indexOf('cool') >= 0;
      return e.g.indexOf(libFilter) >= 0;
    });
    $('#lib-cards').innerHTML = list.map(function (e) { return card(e, { open: true }); }).join('');
  }

  // ---------- Tracker ----------
  var cal = { y: new Date().getFullYear(), m: new Date().getMonth() }, selDay = todayStr(), confirmId = null;

  function weekStart(dateStr) { var d = parseYmd(dateStr); var off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return ymd(d); }

  function entryHtml(e) {
    var feel = e.feel === 'easy' ? 'Felt easy' : e.feel === 'right' ? 'Felt right' : e.feel === 'hard' ? 'Felt hard' : '';
    return '<div class="entry"><div><div class="when">' + esc(focusLabel(e.focus)) + '</div>' +
      '<div class="sub num"><span>' + fmtShort(e.date) + '</span><span>' + e.minutes + ' min</span><span>' + LEVELS[e.level].label + '</span>' + (feel ? '<span>' + feel + '</span>' : '') + '</div></div>' +
      '<button type="button" class="btn ghost sm' + (confirmId === e.id ? ' danger' : '') + '" data-del="' + e.id + '">' + (confirmId === e.id ? 'Tap to delete' : 'Delete') + '</button>' +
      (e.note ? '<p class="note">' + esc(e.note) + '</p>' : '') + '</div>';
  }

  function renderTracker() {
    var log = state.log.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); });
    var t = todayStr(), ws = weekStart(t);
    var weekEntries = log.filter(function (e) { return e.date >= ws; });
    var weekMin = weekEntries.reduce(function (n, e) { return n + e.minutes; }, 0);
    var dates = {}; log.forEach(function (e) { dates[e.date] = 1; });
    var streak = 0, cur = dates[t] ? t : (function () { var d = parseYmd(t); d.setDate(d.getDate() - 1); return ymd(d); })();
    while (dates[cur]) { streak++; var dd = parseYmd(cur); dd.setDate(dd.getDate() - 1); cur = ymd(dd); }
    var totalMin = log.reduce(function (n, e) { return n + e.minutes; }, 0);

    // weekly minutes, last 8 weeks
    var weeks = [], i;
    for (i = 7; i >= 0; i--) { var d0 = parseYmd(ws); d0.setDate(d0.getDate() - 7 * i); weeks.push({ s: ymd(d0), min: 0 }); }
    log.forEach(function (e) { var w = weekStart(e.date); weeks.forEach(function (x) { if (x.s === w) x.min += e.minutes; }); });
    var maxMin = Math.max.apply(null, weeks.map(function (w) { return w.min; }).concat([30]));

    // focus balance last 14 days
    var mix = { abs: 0, arms: 0, legs: 0 };
    log.forEach(function (e) { if (dayDiff(t, e.date) < 14) Object.keys(groupsOf(e.focus)).forEach(function (g) { mix[g]++; }); });
    var maxMix = Math.max(3, mix.abs, mix.arms, mix.legs);

    // calendar
    var first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, dim = new Date(cal.y, cal.m + 1, 0).getDate();
    var cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<div class="dow">' + x[0] + '</div>'; });
    for (i = 0; i < lead; i++) cells.push('<div class="day out"></div>');
    for (i = 1; i <= dim; i++) {
      var ds = cal.y + '-' + pad2(cal.m + 1) + '-' + pad2(i);
      var dots = '';
      log.forEach(function (e) {
        if (e.date !== ds) return;
        var gs = groupsOf(e.focus);
        ['abs', 'arms', 'legs'].forEach(function (g) { if (gs[g]) dots += '<i style="background:var(--c-' + g + ')"></i>'; });
      });
      cells.push('<button type="button" class="day' + (ds === t ? ' today' : '') + (ds === selDay ? ' sel' : '') + '" data-day="' + ds + '" aria-label="' + fmtShort(ds) + (dots ? ', workout logged' : '') + '"><span>' + i + '</span><span class="dots">' + dots + '</span></button>');
    }
    var dayEntries = log.filter(function (e) { return e.date === selDay; });

    $('#tracker').innerHTML =
      '<div class="stats">' +
      '<div class="stat"><div class="v">' + weekEntries.length + '</div><div class="k">workouts this week</div></div>' +
      '<div class="stat"><div class="v">' + weekMin + '<small>min</small></div><div class="k">minutes this week</div></div>' +
      '<div class="stat"><div class="v">' + streak + '<small>' + (streak === 1 ? 'day' : 'days') + '</small></div><div class="k">current streak</div></div>' +
      '<div class="stat"><div class="v">' + log.length + '</div><div class="k">workouts in total · ' + Math.round(totalMin / 60 * 10) / 10 + ' h</div></div></div>' +

      '<div class="t-grid"><div class="panel"><div class="cal-head"><button type="button" class="btn ghost sm" data-cal="-1" aria-label="Previous month">‹</button><h3>' + MONTHS[cal.m] + ' ' + cal.y + '</h3><button type="button" class="btn ghost sm" data-cal="1" aria-label="Next month">›</button></div>' +
      '<div class="cal">' + cells.join('') + '</div>' +
      '<div class="legend"><span><i style="background:var(--c-abs)"></i>Abs</span><span><i style="background:var(--c-arms)"></i>Arms</span><span><i style="background:var(--c-legs)"></i>Legs</span></div>' +
      '<div><h3>' + fmtShort(selDay) + '</h3>' + (dayEntries.length ? dayEntries.map(entryHtml).join('') : '<p class="empty">Nothing logged. Add a session below.</p>') + '</div></div>' +

      '<div style="display:flex;flex-direction:column;gap:18px;min-width:0">' +
      '<div class="panel"><h3>Minutes per week</h3><div class="bars num">' + weeks.map(function (w, k) {
        return '<div class="bar' + (k === 7 ? ' now' : '') + '"><em>' + (w.min || '') + '</em><span style="height:' + Math.max(w.min / maxMin * 100, 2) + '%"></span>' + fmtShort(w.s).split(' ').slice(1).join(' ') + '</div>';
      }).join('') + '</div><p class="muted">Weeks start Monday. Orange is this week.</p></div>' +
      '<div class="panel"><h3>Balance, last 14 days</h3><div class="mix">' + [['abs', 'Abs'], ['arms', 'Arms'], ['legs', 'Legs & glutes']].map(function (g) {
        return '<div class="mix-row"><span>' + g[1] + '</span><div class="track"><span style="width:' + (mix[g[0]] / maxMix * 100) + '%;background:var(--c-' + g[0] + ')"></span></div><span class="num">' + mix[g[0]] + '</span></div>';
      }).join('') + '</div><p class="muted">Days each area was trained. A full body day counts for all three.</p></div></div></div>' +

      '<div class="panel"><h3>Log a session</h3><form class="form" id="log-form">' +
      '<label>Date<input type="date" id="f-date" value="' + selDay + '"></label>' +
      '<label>Minutes<select id="f-min">' + [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90].map(function (m) { return '<option' + (m === 30 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label>' +
      '<label>Intensity<select id="f-level">' + LEVELS.map(function (l, k) { return '<option value="' + k + '"' + (k === 1 ? ' selected' : '') + '>' + l.label + '</option>'; }).join('') + '</select></label>' +
      '<div class="full"><span class="label">Focus</span><div class="chips" id="f-focus" style="margin-top:8px">' + FOCUS.map(function (f) { return chip(f.label, false, 'data-ffocus="' + f.k + '"'); }).join('') + '</div></div>' +
      '<label class="full">Note (optional)<input type="text" id="f-note" maxlength="160" placeholder="How did it feel?"></label>' +
      '<div class="full"><button type="submit" class="btn">Add to tracker</button></div></form></div>' +

      '<div class="panel"><h3>History</h3>' + (log.length ? log.slice(0, 30).map(entryHtml).join('') : '<p class="empty">No sessions yet. Finish a guided workout or log one above and it shows up here.</p>') +
      (log.length > 30 ? '<p class="muted">Showing the latest 30 of ' + log.length + '.</p>' : '') + '</div>' +

      '<details class="panel"><summary>Back up or move your log</summary><div class="how"><p class="muted">Your log lives only in this browser. Copy this text somewhere safe, or paste a backup below to restore it on another device.</p>' +
      '<textarea id="bk-out" readonly aria-label="Backup text">' + esc(JSON.stringify(state.log)) + '</textarea>' +
      '<div><button type="button" class="btn ghost sm" data-act="copy-backup">Copy backup</button></div>' +
      '<textarea id="bk-in" placeholder="Paste a backup here" aria-label="Paste backup"></textarea>' +
      '<div><button type="button" class="btn ghost sm" data-act="import-backup">Restore from backup</button></div></div></details>';
  }

  function addEntry(e) {
    e.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.log.push(e); save();
    return e;
  }

  // ---------- celebration ----------
  var PHOTO_KEY = 'matdaily.photo';
  function getPhoto() { try { return localStorage.getItem(PHOTO_KEY) || ''; } catch (e) { return ''; } }
  function setPhoto(url) {
    try { if (url) localStorage.setItem(PHOTO_KEY, url); else localStorage.removeItem(PHOTO_KEY); return true; } catch (e) { return false; }
  }
  function renderPhotoRow() {
    var p = getPhoto(), prev = $('#photo-prev'), rm = $('#photo-rm'), btn = $('#photo-btn');
    if (!prev) return;
    prev.innerHTML = p ? '<img alt="Your finish-screen photo" src="' + p + '">' : '';
    rm.hidden = !p; btn.textContent = p ? 'Change photo' : 'Choose a photo';
  }
  // Square crop biased toward the top (faces sit high in portraits), shrunk to keep storage small.
  function shrinkPhoto(file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) * 0.15, out = 480;
        var cv = document.createElement('canvas'); cv.width = cv.height = out;
        cv.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, out, out);
        cb(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { cb(''); };
      img.src = r.result;
    };
    r.onerror = function () { cb(''); };
    r.readAsDataURL(file);
  }

  function thumbSvg() {
    return '<svg viewBox="0 0 80 80" aria-hidden="true"><g transform="translate(0,2)"><rect x="14" y="36" width="42" height="34" rx="9" fill="#E2A883"/><rect x="28" y="12" width="14" height="32" rx="7" fill="#E2A883"/>' +
      '<path d="M20 50 H52 M20 58 H52 M22 66 H50" stroke="#C98E69" stroke-width="2.4" stroke-linecap="round" fill="none"/><rect x="10" y="40" width="10" height="26" rx="4" fill="#25282D"/></g></svg>';
  }

  // Illustrated celebration: big smile, hair in a bun, thumbs up.
  function celebrationArt() {
    return '<svg viewBox="0 0 240 260" role="img" aria-label="Smiling with a thumbs up"><g class="char">' +
      '<circle cx="120" cy="140" r="112" fill="var(--accent-soft)"/>' +
      '<path d="M26 262 C26 218 58 200 98 194 L142 194 C182 200 214 218 214 262 Z" fill="var(--tank)"/>' +
      '<line x1="52" y1="222" x2="40" y2="262" stroke="#E2A883" stroke-width="22" stroke-linecap="round"/>' +
      '<rect x="102" y="160" width="36" height="40" rx="14" fill="#D9997A"/>' +
      '<path d="M96 194 Q120 214 144 194 Q120 200 96 194Z" fill="#E2A883"/>' +
      '<path d="M100 200 Q120 224 140 200" stroke="#C9A24D" stroke-width="1.4" fill="none"/><rect x="117" y="214" width="6" height="12" rx="1.5" fill="#C9A24D"/><rect x="113" y="217" width="14" height="5" rx="1.5" fill="#C9A24D"/>' +
      '<g class="thumb-g"><line x1="190" y1="222" x2="222" y2="196" stroke="#E2A883" stroke-width="22" stroke-linecap="round"/><line x1="222" y1="196" x2="206" y2="156" stroke="#E2A883" stroke-width="22" stroke-linecap="round"/>' +
      '<rect x="190" y="136" width="34" height="34" rx="12" fill="#E2A883"/><rect x="199" y="104" width="15" height="42" rx="7.5" fill="#E2A883"/>' +
      '<path d="M192 148 H222 M192 156 H222 M194 164 H220" stroke="#C98E69" stroke-width="2.2" stroke-linecap="round" fill="none"/></g>' +
      '<g class="head-g"><circle cx="120" cy="36" r="23" fill="#5B3B27"/><path d="M104 28 Q120 14 136 30 M108 44 Q122 34 134 44" stroke="#9A6E48" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="74" cy="120" rx="7" ry="11" fill="#D9997A"/><ellipse cx="166" cy="120" rx="7" ry="11" fill="#D9997A"/>' +
      '<ellipse cx="120" cy="118" rx="47" ry="55" fill="#E2A883"/>' +
      '<path d="M70 112 C66 62 98 50 120 50 C146 50 174 62 170 112 C156 90 136 80 118 80 C100 80 84 92 70 112Z" fill="#5B3B27"/>' +
      '<path d="M86 84 C98 70 118 66 138 72 M100 76 C114 70 130 70 146 78" stroke="#9A6E48" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M91 101 Q104 94 115 100 M125 100 Q136 94 149 101" stroke="#4A2F1F" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<g class="blink"><ellipse cx="103" cy="115" rx="5.6" ry="7" fill="#2A1D16"/><ellipse cx="137" cy="115" rx="5.6" ry="7" fill="#2A1D16"/><circle cx="105" cy="112.5" r="1.9" fill="#fff"/><circle cx="139" cy="112.5" r="1.9" fill="#fff"/></g>' +
      '<circle cx="90" cy="136" r="9" fill="#E58C7A" opacity=".45"/><circle cx="150" cy="136" r="9" fill="#E58C7A" opacity=".45"/>' +
      '<path d="M116 124 Q120 132 126 130" stroke="#C98E69" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M90 140 Q120 192 150 140 Q120 146 90 140Z" fill="#7A2E34"/><ellipse cx="120" cy="160" rx="12" ry="5" fill="#D9626B"/><path d="M93 141 Q120 150 147 141 Q142 152 120 154 Q98 152 93 141Z" fill="#fff"/>' +
      '<path d="M90 140 Q120 192 150 140" stroke="#A8434A" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
      '</g></svg>';
  }

  function confettiHtml() {
    var cols = ['#E58A2E', '#3F64E6', '#1A8F77', '#F2C14E', '#E86A8C', '#6672D0'], out = '';
    for (var i = 0; i < 26; i++) {
      out += '<i style="left:' + Math.round((i * 37) % 100) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (((i * 53) % 30) / 10) + 's;animation-duration:' + (2.8 + (i % 5) * 0.4) + 's;--dx:' + (((i * 29) % 80) - 40) + 'px"></i>';
    }
    return '<div class="confetti" aria-hidden="true">' + out + '</div>';
  }

  // ---------- guided player ----------
  var run = null, audio = null, wake = null, mus = null, speaking = false;

  function getAudio() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { /* audio unavailable */ }
    return audio;
  }
  function beep(f, d) {
    if (!prefs().beeps) return;
    var c = getAudio(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
      o.start(); o.stop(c.currentTime + d + 0.02);
    } catch (e) { /* ignore */ }
  }

  // Background music made on the fly: soft pad chords, a light arpeggio and, at higher intensity, a gentle beat.
  var CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]];
  var ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  function tone(c, dest, freq, type, t, dur, gain, attack) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function musicTarget() { return !mus ? 0 : (run && run.paused ? 0.0001 : speaking ? 0.12 : 0.5); }
  function musicApply() {
    if (!mus) return;
    var g = mus.master.gain, t = mus.c.currentTime;
    try { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.linearRampToValueAtTime(musicTarget(), t + 0.4); } catch (e) { /* ignore */ }
  }
  function musicStart(level) {
    var c = getAudio(); if (!c || mus) return;
    try {
      var master = c.createGain(); master.gain.value = 0.0001; master.connect(c.destination);
      var echo = c.createDelay(); echo.delayTime.value = 0.33;
      var fb = c.createGain(); fb.gain.value = 0.32; var wet = c.createGain(); wet.gain.value = 0.45;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
      var padF = c.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 900; padF.connect(master);
      var bpm = [80, 92, 104][level], hatBuf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate), d = hatBuf.getChannelData(0);
      for (var k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
      mus = { c: c, master: master, echo: echo, pad: padF, hat: hatBuf, level: level, step: 0, next: c.currentTime + 0.15, dur: 60 / bpm / 2, timer: null };
      mus.timer = setInterval(musicTick, 100);
      musicApply();
    } catch (e) { mus = null; }
  }
  function musicTick() {
    if (!mus) return;
    var c = mus.c;
    while (mus.next < c.currentTime + 0.6) {
      var t = mus.next, n = mus.step, chord = CHORDS[Math.floor(n / 8) % 4], dur = mus.dur;
      if (n % 8 === 0) chord.slice(0, 3).forEach(function (m, i) { tone(c, mus.pad, mtof(m - 12 + (i === 2 ? 0 : 0)), 'triangle', t, dur * 8, 0.09, 0.5); });
      if (mus.level > 0 || n % 2 === 0) {
        var note = mtof(chord[ARP[n % 8]] + 12), g = tone;
        g(c, mus.master, note, 'triangle', t, dur * 2.2, 0.05, 0.01);
        g(c, mus.echo, note, 'triangle', t, dur * 2.2, 0.04, 0.01);
      }
      if (mus.level > 0 && n % 2 === 0) {
        var o = c.createOscillator(), kg = c.createGain();
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        kg.gain.setValueAtTime(mus.level === 2 ? 0.3 : 0.2, t); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(kg); kg.connect(mus.master); o.start(t); o.stop(t + 0.2);
      }
      if (mus.level > 0 && n % 2 === 1) {
        var src = c.createBufferSource(), hg = c.createGain(), hp = c.createBiquadFilter();
        src.buffer = mus.hat; hp.type = 'highpass'; hp.frequency.value = 6000; hg.gain.value = 0.05;
        src.connect(hp); hp.connect(hg); hg.connect(mus.master); src.start(t);
      }
      mus.next += dur; mus.step++;
    }
  }
  function musicStop() {
    if (!mus) return;
    var m = mus; mus = null; clearInterval(m.timer);
    try { m.master.gain.cancelScheduledValues(m.c.currentTime); m.master.gain.linearRampToValueAtTime(0.0001, m.c.currentTime + 0.6); setTimeout(function () { try { m.master.disconnect(); } catch (e) { /* ignore */ } }, 900); } catch (e) { /* ignore */ }
  }

  // Spoken prompts.
  // On an iPad, use the downloaded "Zoe" voice (Enhanced or Premium). Everywhere else, use the usual pick.
  function isIpad() {
    var ua = navigator.userAgent || '';
    return /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function pickVoice() {
    try {
      var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
      if (isIpad()) {
        var zoe = vs.filter(function (v) { return /zoe/i.test(v.name); });
        var best = zoe.filter(function (v) { return /premium|enhanced/i.test(v.name); })[0] || zoe[0];
        if (best) return best;
      }
      var pref = ['Samantha', 'Ava', 'Allison', 'Karen', 'Serena', 'Moira', 'Daniel'];
      for (var i = 0; i < pref.length; i++) { var f = vs.filter(function (v) { return v.name.indexOf(pref[i]) >= 0; })[0]; if (f) return f; }
      return vs[0] || null;
    } catch (e) { return null; }
  }
  try { if ('speechSynthesis' in window) speechSynthesis.getVoices(); } catch (e) { /* voices load lazily */ }

  function say(text) {
    if (!prefs().voice || !('speechSynthesis' in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(text), v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = 1;
      u.onstart = function () { speaking = true; musicApply(); };
      u.onend = u.onerror = function () { speaking = false; musicApply(); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function spokenDose(ex, work) {
    if (ex.kind === 'hold') return 'for ' + work + ' seconds';
    var per = ex.sides ? work / 2 : work, reps = Math.max(4, Math.round(per / ex.tempo));
    return reps + (ex.sides ? ' reps each side' : ' reps');
  }

  function buildSteps(plan) {
    var steps = [], p = plan.o;
    function add(ex, work, rest, section, round) {
      var base = { ex: ex, section: section, round: round };
      if (ex.sides) {
        steps.push(Object.assign({}, base, { kind: 'work', dur: work / 2, side: 'Right side', work: work }));
        steps.push(Object.assign({}, base, { kind: 'work', dur: work / 2, side: 'Left side', work: work }));
      } else steps.push(Object.assign({}, base, { kind: 'work', dur: work, work: work }));
      if (rest > 0) steps.push(Object.assign({}, base, { kind: 'rest', dur: rest }));
    }
    var wr = Math.min(plan.restS, 5);
    plan.warm.forEach(function (e) { add(e, 40, wr, 'Warm-up'); });
    for (var r = 1; r <= plan.rounds; r++) plan.main.forEach(function (e) { add(e, plan.L.work, plan.restS, 'Round ' + r + ' of ' + plan.rounds, r); });
    plan.cool.forEach(function (e, i) { add(e, 45, i === plan.cool.length - 1 ? 0 : wr, 'Cool-down'); });
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].kind === 'rest') { var n = steps[i + 1]; steps[i].showEx = n ? n.ex : steps[i].ex; }
    }
    return steps;
  }

  function figPair(ex) { var f = MD.figures(ex); return f[0] + f[1]; }

  function startRun() {
    if (!currentPlan) return;
    run = { plan: currentPlan, steps: buildSteps(currentPlan), i: 0, left: 0, paused: false, last: Date.now(), done: false, started: Date.now() };
    run.total = run.steps.reduce(function (n, s) { return n + s.dur; }, 0);
    document.body.style.overflow = 'hidden';
    $('#player').hidden = false;
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }, function () { }); } catch (e) { /* optional */ }
    getAudio();
    if (prefs().music) musicStart(currentPlan.o.level);
    beep(660, 0.12);
    gotoStep(0);
    run.timer = setInterval(tick, 200);
  }

  function elapsedBefore(i) { var n = 0; for (var k = 0; k < i; k++) n += run.steps[k].dur; return n; }

  function nextWork(from) {
    for (var k = from + 1; k < run.steps.length; k++) if (run.steps[k].kind === 'work') return run.steps[k];
    return null;
  }

  function announce(s, first) {
    var ex = s.kind === 'rest' ? s.showEx : s.ex;
    if (s.kind === 'rest') { say('Rest. Next up, ' + ex.name + '.'); return; }
    if (s.side === 'Left side') { say('Switch sides.'); return; }
    var gear = ex.ring ? ' Grab your ring.' : ex.roller ? ' Grab your roller.' : ex.w && run.plan.o.weights ? ' Grab your weights.' : '';
    say((first ? 'Let\'s begin. ' : '') + ex.name + '. ' + spokenDose(ex, s.work) + (s.side ? ', starting on your right.' : '.') + gear);
  }

  function gotoStep(i) {
    if (i >= run.steps.length) return finishRun();
    run.i = clamp(i, 0, run.steps.length - 1);
    run.left = run.steps[run.i].dur;
    run.last = Date.now();
    drawStep();
    announce(run.steps[run.i], run.i === 0);
  }

  function toggleBtn(act, label, on) {
    return '<button type="button" class="btn ghost sm" data-act="' + act + '" aria-pressed="' + on + '">' + label + (on ? ' on' : ' off') + '</button>';
  }

  function drawStep() {
    var s = run.steps[run.i], isRest = s.kind === 'rest', ex = isRest ? s.showEx : s.ex, P = prefs();
    var d = isRest ? null : dose(ex, s.work, run.plan.o);
    var wt = ex.w ? (run.plan.o.weights ? ' Grab your light weights.' : ' No weights: squeeze your fists and move slowly.') : '';
    if (ex.ring) wt += ' Grab your Pilates ring.';
    if (ex.roller) wt += ' Grab your foam roller.';
    var html =
      '<div class="p-top"><button type="button" class="btn ghost sm" data-act="p-end">End</button><div class="p-prog"><span id="p-bar"></span></div><span class="p-left num" id="p-left"></span></div>' +
      '<div class="p-toggles">' + toggleBtn('p-music', 'Music', P.music) + toggleBtn('p-voice', 'Voice', P.voice) + toggleBtn('p-beeps', 'Beeps', P.beeps) + '</div>' +
      '<div class="p-main"><div class="p-fig anim">' + figPair(ex) + '</div><div class="p-info">' +
      '<span class="phase' + (isRest ? ' rest' : '') + '">' + (isRest ? 'Rest · get ready' : (s.side ? s.side : 'Work')) + '</span>' +
      '<h2>' + esc(ex.name) + '</h2>' +
      '<div class="p-time num" id="p-time"></div>' +
      (isRest ? '<p class="p-dose">Next: ' + esc(ex.name) + '</p>' : '<p class="p-dose num">' + d.text + '</p>') +
      '<p class="p-cue">' + (isRest ? esc(ex.blurb) : esc(ex.steps[1] || ex.steps[0]) + wt) + '</p>' +
      '<p class="p-cue"><b>Think:</b> ' + esc(ex.cues[0]) + '</p></div></div>' +
      '<p class="p-next" id="p-up"></p>' +
      '<div class="p-ctl"><button type="button" class="btn ghost" data-act="p-prev">Back</button><button type="button" class="btn big" data-act="p-pause" id="p-pause">' + (run.paused ? 'Resume' : 'Pause') + '</button><button type="button" class="btn ghost" data-act="p-skip">Skip</button></div>';
    $('#player').innerHTML = html;
    updateTime();
  }

  function updateTime() {
    if (!run || run.done) return;
    var s = run.steps[run.i], left = Math.max(0, Math.ceil(run.left));
    var t = $('#p-time'); if (t) t.textContent = Math.floor(left / 60) + ':' + pad2(left % 60);
    var elapsed = elapsedBefore(run.i) + (s.dur - run.left);
    var bar = $('#p-bar'); if (bar) bar.style.width = clamp(elapsed / run.total * 100, 0, 100) + '%';
    var pl = $('#p-left'); if (pl) pl.textContent = Math.ceil((run.total - elapsed) / 60) + ' min left';
    var up = $('#p-up');
    if (up) {
      var nx = s.kind === 'rest' ? run.steps[run.i + 1] : nextWork(run.i), same = nx && nx.ex === s.ex && s.kind !== 'rest';
      var nxStep = run.steps[run.i + 1];
      var soon = s.kind === 'work' && nxStep && nxStep.kind === 'work' && left <= 10 && nxStep.ex !== s.ex;
      up.classList.toggle('soon', !!soon);
      up.innerHTML = esc(s.section) + (nx && !same ? ' · Next: <b>' + esc(nx.ex.name) + '</b>' + (soon || (s.kind === 'rest' && left <= 10) ? ' in ' + left : '') : (same ? ' · Next: <b>switch sides</b>' + (left <= 10 ? ' in ' + left : '') : ' · Last move'));
    }
  }

  function tick() {
    if (!run || run.done) return;
    var now = Date.now(), dt = (now - run.last) / 1000; run.last = now;
    if (run.paused) return;
    var s = run.steps[run.i], before = Math.ceil(run.left);
    run.left -= dt;
    var after = Math.ceil(run.left);
    if (after !== before && after > 0 && after <= 3) beep(520, 0.08);
    if (s.kind === 'work' && !s.heads && run.left <= 10 && s.dur >= 14) {
      var nx = run.steps[run.i + 1];
      if (nx && nx.kind === 'work' && nx.ex !== s.ex) { s.heads = true; say('Next up, ' + nx.ex.name + '.'); }
    }
    if (run.left <= 0) {
      var nxt = run.steps[run.i + 1];
      if (nxt && nxt.kind === 'work') beep(880, 0.25);
      gotoStep(run.i + 1);
      return;
    }
    updateTime();
  }

  function finishRun() {
    run.done = true; clearInterval(run.timer); musicStop();
    beep(660, 0.15); setTimeout(function () { beep(880, 0.3); }, 180);
    say('Workout complete. Nice work.');
    var p = run.plan.o, mins = Math.round(run.total / 60);
    var entry = addEntry({ date: todayStr(), minutes: mins, focus: p.focus.slice(), level: p.level, feel: null, note: '', src: 'guided' });
    run.entryId = entry.id;
    var photo = getPhoto();
    $('#player').innerHTML = confettiHtml() + '<div class="p-done">' +
      (photo ? '<div class="cele-photo"><img alt="" src="' + photo + '"><div class="badge">' + thumbSvg() + '</div></div>' : '<div class="cele">' + celebrationArt() + '</div>') +
      '<p class="eyebrow">Workout complete</p><h1>Nice work.</h1>' +
      '<p class="blurb">' + esc(focusLabel(p.focus)) + ' · ' + mins + ' min · ' + LEVELS[p.level].label + '</p>' +
      '<p class="saved">Saved to your tracker.</p>' +
      '<p class="blurb">How did it feel?</p>' +
      '<div class="feel"><button type="button" class="btn ghost" data-feel="easy">Too easy</button><button type="button" class="btn ghost" data-feel="right">Just right</button><button type="button" class="btn ghost" data-feel="hard">Too hard</button></div>' +
      '<div class="feel"><button type="button" class="btn" data-act="p-close">Done</button><button type="button" class="btn ghost sm" data-act="p-unlog">Remove from tracker</button></div></div>';
  }

  function closePlayer() {
    if (run) { clearInterval(run.timer); run = null; }
    musicStop(); speaking = false;
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    $('#player').hidden = true; $('#player').innerHTML = '';
    document.body.style.overflow = '';
    try { if (wake) { wake.release(); wake = null; } } catch (e) { /* optional */ }
  }

  function logPlan(feel, src) {
    var p = currentPlan.o;
    addEntry({ date: todayStr(), minutes: Math.round(currentPlan.total / 60), focus: p.focus.slice(), level: p.level, feel: feel || null, note: '', src: src });
  }

  // ---------- routing ----------
  var TABS = ['today', 'library', 'tracker'];
  function route() {
    var h = (location.hash || '').replace('#', '');
    if (TABS.indexOf(h) < 0) h = 'today';
    TABS.forEach(function (t) { $('#view-' + t).hidden = t !== h; });
    $$('.tabs a').forEach(function (a) { if (a.dataset.tab === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (h === 'today') renderToday();
    if (h === 'library') renderLibrary();
    if (h === 'tracker') renderTracker();
    window.scrollTo(0, 0);
  }

  // ---------- events ----------
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('button, a'); if (!el) return;
    var p = prefs();
    if (el.dataset.focus) {
      var k = el.dataset.focus, f = p.focus.slice();
      if (k === 'full') f = ['full'];
      else { f = f.filter(function (x) { return x !== 'full'; }); var ix = f.indexOf(k); if (ix >= 0) f.splice(ix, 1); else f.push(k); if (!f.length) f = [k]; }
      p.focus = f; save(); renderSuggest(); renderBuilder(); renderPlan(); return;
    }
    if (el.dataset.time) { p.minutes = +el.dataset.time; save(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.level) { p.level = +el.dataset.level; save(); renderSuggest(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.roller) { p.roller = el.dataset.roller === '1'; save(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.rest) { p.restSec = +el.dataset.rest; save(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.ring) { p.ring = el.dataset.ring === '1'; save(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.weights) { p.weights = el.dataset.weights === '1'; save(); renderBuilder(); renderPlan(); return; }
    if (el.dataset.lib) { libFilter = el.dataset.lib; renderLibrary(); return; }
    if (el.dataset.day) { selDay = el.dataset.day; renderTracker(); return; }
    if (el.dataset.cal) { cal.m += +el.dataset.cal; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } renderTracker(); return; }
    if (el.dataset.ffocus) { var on = el.getAttribute('aria-pressed') === 'true'; if (el.dataset.ffocus === 'full') $$('[data-ffocus]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); else $('[data-ffocus="full"]').setAttribute('aria-pressed', 'false'); el.setAttribute('aria-pressed', on ? 'false' : 'true'); return; }
    if (el.dataset.del) {
      if (confirmId === el.dataset.del) { state.log = state.log.filter(function (e) { return e.id !== confirmId; }); confirmId = null; save(); toast('Entry deleted'); }
      else { confirmId = el.dataset.del; setTimeout(function () { if (confirmId) { confirmId = null; if (!$('#view-tracker').hidden) renderTracker(); } }, 3500); }
      renderTracker(); return;
    }
    if (el.dataset.feel) {
      var en = run && run.entryId ? state.log.filter(function (e) { return e.id === run.entryId; })[0] : null;
      if (en) { en.feel = el.dataset.feel; save(); } else if (currentPlan) logPlan(el.dataset.feel, 'guided');
      closePlayer(); toast('Saved to your tracker'); location.hash = '#tracker'; if (!$('#view-tracker').hidden) renderTracker(); return;
    }
    var act = el.dataset.act; if (!act) return;
    if (act === 'use-suggest') { p.focus = suggest().focus; save(); renderSuggest(); renderBuilder(); renderPlan(); }
    else if (act === 'shuffle') { state.shuffle = (state.shuffle || 0) + 1; save(); renderPlan(); toast('New mix of moves'); }
    else if (act === 'start') startRun();
    else if (act === 'quicklog') { logPlan(null, 'quick'); toast('Logged ' + Math.round(currentPlan.total / 60) + ' min to your tracker'); }
    else if (act === 'p-end') { if (run && !run.done && el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Tap again to end'; setTimeout(function () { el.dataset.sure = ''; el.textContent = 'End'; }, 3000); } else closePlayer(); }
    else if (act === 'p-close') { closePlayer(); toast('Saved to your tracker'); location.hash = '#tracker'; if (!$('#view-tracker').hidden) renderTracker(); }
    else if (act === 'photo-remove') { setPhoto(''); renderPhotoRow(); toast('Photo removed'); }
    else if (act === 'p-unlog') { var id = run && run.entryId; state.log = state.log.filter(function (e) { return e.id !== id; }); save(); closePlayer(); toast('Removed from your tracker'); }
    else if (act === 'save-playlist') {
      var raw = ($('#pl-input').value || '').trim(), url = parsePlaylist(raw);
      if (raw && !url) { toast('That does not look like a Spotify link'); return; }
      p.playlist = url; if (url) p.music = false; save(); renderBuilder(); renderPlan();
      toast(url ? 'Playlist saved. App music is off so Spotify plays.' : 'Playlist removed');
    }
    else if (act === 'p-pause') { run.paused = !run.paused; run.last = Date.now(); $('#p-pause').textContent = run.paused ? 'Resume' : 'Pause'; musicApply(); try { if (run.paused && 'speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    else if (act === 'p-skip') gotoStep(run.i + 1);
    else if (act === 'p-prev') gotoStep(run.left < run.steps[run.i].dur - 2 ? run.i : Math.max(0, run.i - 1));
    else if (act === 'p-music' || act === 'p-voice' || act === 'p-beeps') {
      var key = act.slice(2); p[key] = !p[key]; save();
      el.textContent = el.textContent.replace(/ (on|off)$/, p[key] ? ' on' : ' off'); el.setAttribute('aria-pressed', p[key]);
      if (key === 'music') { if (p.music && run && !run.done) musicStart(run.plan.o.level); else musicStop(); }
      if (key === 'voice' && !p.voice) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } speaking = false; musicApply(); }
    }
    else if (act === 'copy-backup') {
      var ta = $('#bk-out');
      var done = function () { toast('Backup copied'); };
      var fallback = function () { ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it'); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
    }
    else if (act === 'import-backup') {
      try {
        var arr = JSON.parse($('#bk-in').value), have = {}, n = 0;
        if (!Array.isArray(arr)) throw new Error('bad');
        state.log.forEach(function (e) { have[e.id] = 1; });
        arr.forEach(function (e) {
          if (e && e.id && e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Array.isArray(e.focus) && !have[e.id]) {
            state.log.push({ id: String(e.id), date: e.date, minutes: clamp(+e.minutes || 30, 1, 300), focus: e.focus.filter(function (k) { return ['abs', 'arms', 'legs', 'full'].indexOf(k) >= 0; }), level: clamp(+e.level || 0, 0, 2), feel: e.feel || null, note: String(e.note || '').slice(0, 160), src: 'import' });
            n++;
          }
        });
        save(); renderTracker(); toast(n + ' sessions restored');
      } catch (e) { toast('That backup could not be read'); }
    }
  });

  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'photo-input' || !ev.target.files || !ev.target.files[0]) return;
    shrinkPhoto(ev.target.files[0], function (url) {
      if (!url || !setPhoto(url)) { toast('Could not use that photo. Try another one.'); return; }
      renderPhotoRow(); toast('Photo saved on this device');
    });
    ev.target.value = '';
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'log-form') return;
    ev.preventDefault();
    var focus = $$('[data-ffocus]').filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.dataset.ffocus; });
    if (!focus.length) { toast('Pick at least one focus'); return; }
    var date = $('#f-date').value || todayStr();
    addEntry({ date: date, minutes: +$('#f-min').value, focus: focus, level: +$('#f-level').value, feel: null, note: $('#f-note').value.trim(), src: 'manual' });
    selDay = date; var d = parseYmd(date); cal.y = d.getFullYear(); cal.m = d.getMonth();
    toast('Added to your tracker'); renderTracker();
  });

  document.addEventListener('keydown', function (ev) {
    if (!run || run.done || $('#player').hidden) return;
    if (ev.key === ' ' && ev.target.tagName !== 'BUTTON') { ev.preventDefault(); $('#p-pause').click(); }
    if (ev.key === 'ArrowRight') gotoStep(run.i + 1);
    if (ev.key === 'ArrowLeft') gotoStep(Math.max(0, run.i - 1));
    if (ev.key === 'Escape') closePlayer();
  });

  window.addEventListener('hashchange', route);
  route();
})();
