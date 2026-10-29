/* Mat Daily: exercise library and figure illustrator.
   Every exercise has two key poses (start / move). Figures are drawn from
   joint angles, so the pictures stay consistent and need no image files. */
(function () {
  'use strict';

  // ---------- figure engine ----------
  var T = 17, UA = 21, FA = 19, TH = 28, SH = 27, NK = 13, HR = 7;
  var rad = function (d) { return d * Math.PI / 180; };
  var pt = function (p, a, l) { return [p[0] + l * Math.cos(rad(a)), p[1] + l * Math.sin(rad(a))]; };

  function ik(root, target, l1, l2, bend) {
    var dx = target[0] - root[0], dy = target[1] - root[1];
    var d = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
    var max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.5;
    d = Math.min(Math.max(d, min), max);
    var a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
    var ang = base + bend * a;
    return [
      [root[0] + l1 * Math.cos(ang), root[1] + l1 * Math.sin(ang)],
      [root[0] + d * Math.cos(base), root[1] + d * Math.sin(base)]
    ];
  }

  function limb(root, spec, l1, l2, defBend) {
    if (Array.isArray(spec)) {
      var j = pt(root, spec[0], l1);
      return [root, j, pt(j, spec[1], l2)];
    }
    var target = spec.rel ? [root[0] + spec.rel[0], root[1] + spec.rel[1]] : spec.to;
    var r = ik(root, target, l1, l2, spec.b === undefined ? defBend : spec.b);
    return [root, r[0], r[1]];
  }

  function solve(p) {
    var t1 = p.t, t2 = p.t2 === undefined ? p.t : p.t2;
    var s1 = pt(p.h, t1, T), s2 = pt(s1, t2, T);
    return {
      hip: p.h, s1: s1, s2: s2,
      head: pt(s2, p.hd === undefined ? t2 : p.hd, NK),
      arms: p.a.map(function (s) { return limb(s2, s, UA, FA, 1); }),
      legs: p.l.map(function (s) { return limb(p.h, s, TH, SH, -1); }),
      ring: p.ring
    };
  }

  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var poly = function (pts, cls) {
    return '<polyline class="' + cls + '" points="' + pts.map(function (q) { return f1(q[0]) + ',' + f1(q[1]); }).join(' ') + '"/>';
  };

  function weightsAt(arm) {
    var h = arm[2], f = arm[1];
    var a = Math.atan2(h[1] - f[1], h[0] - f[0]) + Math.PI / 2;
    var dx = Math.cos(a) * 5.5, dy = Math.sin(a) * 5.5;
    return '<line class="wt" x1="' + f1(h[0] - dx) + '" y1="' + f1(h[1] - dy) + '" x2="' + f1(h[0] + dx) + '" y2="' + f1(h[1] + dy) + '"/>';
  }

  function ringCenter(sk) {
    var r = sk.ring, a, b;
    if (r.at === 'knees') { a = sk.legs[0][1]; b = sk.legs[1][1]; }
    else if (r.at === 'ankles') { a = sk.legs[0][2]; b = sk.legs[1][2]; }
    else { a = sk.arms[0][2]; b = sk.arms[1][2]; }
    return [(a[0] + b[0]) / 2 + (r.dx || 0), (a[1] + b[1]) / 2 + (r.dy || 0)];
  }

  function ringShape(sk) {
    var c = ringCenter(sk);
    return '<ellipse class="ring" cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" rx="' + sk.ring.rx + '" ry="' + sk.ring.ry + '"/>';
  }

  function shapes(sk, withWeights) {
    var out = '';
    out += poly(sk.arms[1], 'far') + poly(sk.legs[1], 'far');
    out += poly([sk.hip, sk.s1, sk.s2], 'body torso');
    out += poly(sk.legs[0], 'body');
    out += poly(sk.arms[0], 'body');
    out += '<circle class="head" cx="' + f1(sk.head[0]) + '" cy="' + f1(sk.head[1]) + '" r="' + HR + '"/>';
    if (withWeights) out += weightsAt(sk.arms[1]) + weightsAt(sk.arms[0]);
    if (sk.ring) out += ringShape(sk);
    return out;
  }

  function allPoints(sk) {
    var pts = [sk.hip, sk.s1, sk.s2, sk.head];
    sk.arms.concat(sk.legs).forEach(function (l) { pts = pts.concat(l); });
    if (sk.ring) { var rc = ringCenter(sk); pts.push([rc[0] - sk.ring.rx, rc[1] - sk.ring.ry], [rc[0] + sk.ring.rx, rc[1] + sk.ring.ry]); }
    return pts;
  }

  // One shared viewBox for both frames so the figure doesn't jump between them.
  function viewBoxFor(sks) {
    var minX = 1e9, maxX = -1e9, minY = 1e9;
    sks.forEach(function (sk) {
      allPoints(sk).forEach(function (q) {
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]);
      });
    });
    var pad = 12, floor = 119, top = minY - HR - pad;
    var w = Math.max(maxX - minX + 2 * pad + 6, (floor - top) * 1.45);
    var h = w / 1.45;
    var x = (minX + maxX) / 2 - w / 2;
    return { x: x, y: floor - h, w: w, h: h };
  }

  function frameSvg(sk, vb, weights, extraCls) {
    return '<svg class="fig ' + (extraCls || '') + '" viewBox="' + f1(vb.x) + ' ' + f1(vb.y) + ' ' + f1(vb.w) + ' ' + f1(vb.h) +
      '" role="img" aria-hidden="true"><rect class="mat" x="' + f1(vb.x + 4) + '" y="110.5" width="' + f1(vb.w - 8) + '" height="6" rx="3"/>' +
      shapes(sk, weights) + '</svg>';
  }

  function figures(ex) {
    var sks = ex.frames.map(solve);
    var vb = viewBoxFor(sks);
    return sks.map(function (sk) { return frameSvg(sk, vb, ex.w, ''); });
  }

  // ---------- reusable base poses ----------
  var P = function (base, o) { var r = {}, k; for (k in base) r[k] = base[k]; for (k in o) r[k] = o[k]; return r; };
  var SUP = { h: [150, 106], t: 180, a: [[0, 0], [0, 0]], l: [[0, 0], [0, 0]] };
  var SUPK = P(SUP, { l: [[-55, 55], [-52, 58]] });
  var QUAD = { h: [118, 76], t: -17.4, a: [[90, 90], [90, 90]], l: [[90, 180], [90, 180]] };
  var STAND = { h: [120, 55], t: -90, a: [[90, 90], [92, 92]], l: [{ to: [120, 110] }, { to: [120, 110] }] };
  var BR_UP = { h: [138, 86], t: 148, hd: 180, a: [[0, 0], [0, 0]], l: [{ to: [188, 106], b: -1 }, { to: [190, 106], b: -1 }] };
  var BR_DN = P(BR_UP, { h: [143, 106], t: 180 });
  var TUCK = [[-115, 10], [-112, 14]];
  var CURL = { t: 180, t2: 205, hd: 210 };

  // ---------- exercises ----------
  // kind: 'reps' | 'hold'. tempo = seconds per rep. sides = do each side.
  // g = body areas. lvl 1 easy, 2 medium, 3 hard. use = which part of the session it fits.
  var EX = [
    // ===== ABS / CORE =====
    {
      id: 'hundred', name: 'The Hundred', g: ['abs'], pos: 'supine', lvl: 2, kind: 'hold', tempo: 1, use: ['main'],
      blurb: 'The classic Pilates warm-up for the deep abs. Pump the arms while you breathe in a steady rhythm.',
      steps: ['Lie on your back, lift your head and shoulders, and hold your legs in tabletop (knees over hips).',
        'Reach your arms long by your sides, palms down, hovering just off the mat.',
        'Pump your arms in small, quick beats. Inhale for 5 beats, exhale for 5.',
        'Keep your low back heavy on the mat. Straighten your legs to a 45° angle to make it harder.'],
      cues: ['Chin gently toward chest', 'Ribs knit together', 'Pump from the shoulder, not the wrist'],
      easier: 'Keep your head down and feet on the floor, just pump the arms.', harder: 'Extend both legs to 45° and lower them as far as your low back stays flat.',
      feel: 'Deep abs, shoulders',
      frames: [P(SUP, { h: [145, 106], t: 180, t2: 205, hd: 208, a: [[8, 8], [8, 8]], l: [[-90, 0], [-88, 2]] }),
        P(SUP, { h: [145, 106], t: 180, t2: 205, hd: 208, a: [[-6, -6], [-6, -6]], l: [[-45, -45], [-42, -42]] })]
    },
    {
      id: 'rollup', name: 'Roll-Up', g: ['abs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 6, use: ['main'],
      blurb: 'A slow, controlled roll from lying to sitting. It builds spinal flexibility and abdominal strength.',
      steps: ['Lie flat with legs long and arms reaching up toward the ceiling.',
        'Inhale, then exhale as you nod your chin and peel your spine off the mat one vertebra at a time.',
        'Reach over your legs in a deep C-curve, pulling your belly button toward your spine.',
        'Inhale at the top. Exhale and roll back down slowly, with no thumping.'],
      cues: ['Peel and press, do not jerk', 'Flex your feet', 'Move like you are rolling a wheel'],
      easier: 'Bend your knees and hold the backs of your thighs.', harder: 'Start with arms overhead on the floor and keep your legs glued together.',
      feel: 'Abs, hamstrings (stretch)',
      frames: [{ h: [100, 106], t: 180, a: [[-90, -90], [-85, -85]], l: [[0, 0], [0, 0]] },
        { h: [100, 106], t: -60, t2: -25, hd: 0, a: [[10, 10], [12, 12]], l: [[0, 0], [0, 0]] }]
    },
    {
      id: 'sls', name: 'Single-Leg Stretch', g: ['abs'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 3, use: ['main'],
      blurb: 'Switch one knee in, one leg out, with your head and shoulders curled up. Great for steady core control.',
      steps: ['Curl your head and shoulders up. Pull one knee in and hold the shin with both hands.',
        'Extend the other leg long at about 45°.',
        'Switch legs, changing hands as you go. Exhale as you switch, inhale on the hold.',
        'Keep the torso still. Only the legs move.'],
      cues: ['Low back stays heavy', 'Elbows wide', 'Switch smoothly'],
      easier: 'Rest your head down and extend the leg higher.', harder: 'Lower the extended leg and speed up the switch.',
      feel: 'Abs, hip flexors',
      frames: [P(SUP, P(CURL, { h: [145, 106], a: [{ to: [135, 83], b: -1 }, { to: [148, 88], b: -1 }], l: [TUCK[0], [-35, -35]] })),
        P(SUP, P(CURL, { h: [145, 106], a: [{ to: [135, 83], b: -1 }, { to: [148, 88], b: -1 }], l: [[-35, -35], TUCK[1]] }))]
    },
    {
      id: 'dls', name: 'Double-Leg Stretch', g: ['abs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'Hug your knees in, then reach arms and legs out long in opposite directions.',
      steps: ['Curl up with your knees tucked and your hands on your shins.',
        'Inhale and stretch your arms overhead and your legs out at 45°.',
        'Exhale and circle your arms wide, pulling your knees back in.',
        'Keep your head and shoulders lifted the whole time.'],
      cues: ['Stretch from the center', 'Do not let the ribs flare', 'Legs only as low as the low back allows'],
      easier: 'Keep your head down on the mat.', harder: 'Reach legs lower, closer to the floor.',
      feel: 'Abs, shoulders',
      frames: [P(SUP, P(CURL, { h: [145, 106], a: [{ to: [138, 84], b: -1 }, { to: [146, 88], b: -1 }], l: [[-115, 15], [-112, 18]] })),
        P(SUP, P(CURL, { h: [145, 106], a: [[200, 200], [205, 205]], l: [[-40, -40], [-37, -37]] }))]
    },
    {
      id: 'lowers', name: 'Double-Leg Lowers', g: ['abs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'Lower both legs with control, like the reformer footbar leg work, then lift them back up.',
      steps: ['Lie on your back with both legs straight up toward the ceiling and head lifted.',
        'Exhale and slowly lower your legs as far as you can with your low back still flat.',
        'Inhale at the bottom.',
        'Exhale and lift the legs back up by pulling your lower belly in.'],
      cues: ['Tailbone stays heavy', 'Think long legs, not high legs', 'Stop before the back arches'],
      easier: 'Bend your knees slightly or only lower halfway.', harder: 'Add a pause at the bottom and keep your head up.',
      feel: 'Lower abs',
      frames: [P(SUP, P(CURL, { h: [145, 106], a: [[8, 8], [8, 8]], l: [[-90, -90], [-92, -92]] })),
        P(SUP, P(CURL, { h: [145, 106], a: [[8, 8], [8, 8]], l: [[-25, -25], [-22, -22]] }))]
    },
    {
      id: 'teaser', name: 'Teaser', g: ['abs'], pos: 'supine', lvl: 3, kind: 'reps', tempo: 6, use: ['main'],
      blurb: 'Roll up into a V-shape and balance on your sit bones. The big challenge of mat Pilates.',
      steps: ['Lie back with legs lifted to 45° and arms overhead.',
        'Exhale and float your arms up as you roll your chest off the mat.',
        'Balance in a V with arms reaching alongside your legs, spine long.',
        'Inhale to hold, exhale and roll down with control.'],
      cues: ['Chest lifted, not collapsed', 'Reach through the fingertips', 'Wide, strong sit bones'],
      easier: 'Keep your knees bent in tabletop.', harder: 'Hold the V for 3 breaths before lowering.',
      feel: 'Whole core, hip flexors',
      frames: [{ h: [120, 106], t: 180, a: [[-90, -90], [-88, -88]], l: [[-45, -45], [-42, -42]] },
        { h: [120, 106], t: -115, t2: -105, hd: -100, a: [[-45, -45], [-43, -43]], l: [[-45, -45], [-42, -42]] }]
    },
    {
      id: 'deadbug', name: 'Dead Bug', g: ['abs'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 4, use: ['main', 'warm'],
      blurb: 'Opposite arm and leg lower while your trunk stays totally still. Simple and very effective.',
      steps: ['Lie on your back with arms straight up and knees in tabletop.',
        'Exhale and slowly reach one arm overhead while the opposite leg extends long.',
        'Hover both just above the floor.',
        'Inhale back to the start, then switch sides.'],
      cues: ['Flat low back, always', 'Slow like honey', 'Ribs pulled down'],
      easier: 'Move only the legs, keep arms up.', harder: 'Add light weights in your hands.',
      feel: 'Deep abs, coordination',
      frames: [P(SUP, { a: [[-90, -90], [-88, -88]], l: [[-90, 0], [-88, 2]] }),
        P(SUP, { a: [[180, 180], [-90, -90]], l: [[-90, 0], [2, 2]] })]
    },
    {
      id: 'forearmplank', name: 'Forearm Plank', g: ['abs', 'arms'], pos: 'quad', lvl: 2, kind: 'hold', tempo: 4, use: ['main'],
      blurb: 'One long line from head to heels. Hold it, then add a slow leg lift to light up the glutes.',
      steps: ['Place your forearms on the mat with elbows under shoulders.',
        'Step your feet back, legs straight, body in one long line.',
        'Pull your belly in and squeeze your glutes. Breathe steadily.',
        'Lift one leg a few inches, lower, then switch.'],
      cues: ['Do not sink in the low back', 'Push the floor away', 'Look at a spot between your hands'],
      easier: 'Drop to your knees.', harder: 'Hold the leg lift for 3 breaths each side.',
      feel: 'Abs, shoulders, glutes',
      frames: [{ h: [127, 93], t: -13.6, t2: -10, hd: -10, a: [[90, 0], [90, 0]], l: [[166.4, 166.4], [166.4, 166.4]] },
        { h: [127, 93], t: -13.6, t2: -10, hd: -10, a: [[90, 0], [90, 0]], l: [[192, 192], [166.4, 166.4]] }]
    },
    {
      id: 'spine', name: 'Spine Stretch Forward', g: ['abs'], pos: 'seated', lvl: 1, kind: 'reps', tempo: 6, use: ['main', 'cool', 'warm'],
      blurb: 'Sit tall, then curve forward over your legs. A lovely stretch for the back and hamstrings that works the abs too.',
      steps: ['Sit tall with legs straight and about shoulder-width apart, arms reaching forward.',
        'Exhale and curl forward, scooping the belly in, head dropping first.',
        'Reach beyond your toes, then inhale to stack the spine back up.',
        'Imagine a wall behind you to lean against as you sit up.'],
      cues: ['Grow tall first', 'Scoop, do not hunch', 'Keep the sit bones heavy'],
      easier: 'Sit on a folded towel or bend your knees.', harder: 'Hold the curve for 3 breaths.',
      feel: 'Abs, back, hamstrings (stretch)',
      frames: [{ h: [110, 106], t: -90, a: [[0, 0], [2, 2]], l: [[0, 0], [0, 0]] },
        { h: [110, 106], t: -60, t2: -10, hd: 20, a: [[20, 20], [22, 22]], l: [[0, 0], [0, 0]] }]
    },
    {
      id: 'swim', name: 'Swimming', g: ['abs', 'legs'], pos: 'prone', lvl: 2, kind: 'hold', tempo: 1, use: ['main'],
      blurb: 'Lie on your belly and flutter opposite arms and legs. It strengthens the back, glutes and core together.',
      steps: ['Lie face down with arms long overhead and legs straight.',
        'Lift your arms, chest and legs a little off the mat, eyes down.',
        'Flutter opposite arm and leg in quick small beats.',
        'Breathe in for 5 beats, out for 5.'],
      cues: ['Long neck', 'Reach, do not scrunch', 'Squeeze the glutes'],
      easier: 'Lift only the legs or only the arms.', harder: 'Lift higher and speed up the beats.',
      feel: 'Back, glutes, core',
      frames: [{ h: [150, 106], t: 180, t2: 195, hd: 200, a: [[195, 195], [175, 175]], l: [[2, 2], [-8, -8]] },
        { h: [150, 106], t: 180, t2: 195, hd: 200, a: [[175, 175], [195, 195]], l: [[-8, -8], [2, 2]] }]
    },
    {
      id: 'catcow', name: 'Cat-Cow', g: ['abs'], pos: 'quad', lvl: 1, kind: 'reps', tempo: 5, use: ['warm', 'main'], wo: 2,
      blurb: 'Round and arch your spine to wake up your back and core. Perfect to start the session.',
      steps: ['Start on hands and knees, wrists under shoulders, knees under hips.',
        'Exhale: round your spine up like a cat and tuck your tailbone.',
        'Inhale: lower your belly, lift your chest and gaze forward.',
        'Move slowly and make the movement bigger each round.'],
      cues: ['Move through the whole spine', 'Press the floor away', 'Smooth breath'],
      easier: 'Make the range smaller.', harder: 'Pause at each end for a breath.',
      feel: 'Spine mobility, abs',
      frames: [P(QUAD, { t: -55, t2: 25, hd: 80, a: [{ rel: [0, 37], b: 1 }, { rel: [0, 37], b: 1 }] }),
        P(QUAD, { t: 10, t2: -30, hd: -45, a: [{ rel: [0, 35.5], b: 1 }, { rel: [0, 35.5], b: 1 }] })]
    },
    {
      id: 'birddog', name: 'Bird Dog', g: ['abs', 'legs'], pos: 'quad', lvl: 1, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'Reach opposite arm and leg while staying perfectly steady. Builds a strong, balanced core.',
      steps: ['Start on hands and knees with a flat back.',
        'Exhale and reach one arm forward and the opposite leg back.',
        'Keep hips level, as if a glass of water sits on your lower back.',
        'Inhale to return, then switch sides.'],
      cues: ['Long line fingertip to heel', 'No rocking', 'Neck neutral'],
      easier: 'Lift only the arm or only the leg.', harder: 'Draw elbow and knee together under you, then extend.',
      feel: 'Core, back, glutes',
      frames: [QUAD, P(QUAD, { hd: -12, a: [[-12, -12], [90, 90]], l: [[90, 180], [185, 185]] })]
    },

    // ===== ARMS (light weights) =====
    {
      id: 'chest', name: 'Chest Press', g: ['arms'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 3, w: true, use: ['main'],
      blurb: 'Lie back with knees bent and press the weights straight up. Works the chest, shoulders and triceps.',
      steps: ['Lie on your back, knees bent, feet flat. Hold a weight in each hand with elbows bent beside you.',
        'Exhale and press the weights straight up over your chest.',
        'Inhale and lower with control until your elbows touch the mat.',
        'Keep your ribs down and shoulders away from your ears.'],
      cues: ['Wrists straight', 'Press up, slightly together', 'Stay slow on the way down'],
      easier: 'No weights, or use soft water bottles.', harder: 'Lift into a bridge as you press.',
      feel: 'Chest, triceps, front shoulders',
      frames: [P(SUPK, { a: [[5, -90], [8, -90]] }), P(SUPK, { a: [[-90, -90], [-88, -88]] })]
    },
    {
      id: 'curl', name: 'Standing Bicep Curl', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, w: true, use: ['main'],
      blurb: 'Stand tall in Pilates stance and curl the weights with your elbows glued to your sides.',
      steps: ['Stand with heels together, toes slightly apart, abs lifted. Hold weights with palms forward.',
        'Exhale and curl the weights toward your shoulders.',
        'Inhale and lower slowly, fully straightening the elbows.',
        'Keep your upper arms still.'],
      cues: ['Elbows stay pinned', 'Do not swing', 'Tall posture'],
      easier: 'No weights or lighter weights.', harder: 'Curl for 2 counts up, 4 counts down.',
      feel: 'Biceps',
      frames: [P(STAND, {}), P(STAND, { a: [[90, -70], [92, -65]] })]
    },
    {
      id: 'ohp', name: 'Overhead Press', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, w: true, use: ['main'],
      blurb: 'Press straight up while keeping your ribs and core steady.',
      steps: ['Stand tall with weights at shoulder height, palms facing forward.',
        'Exhale and press the weights overhead until your arms are long.',
        'Inhale and lower back to shoulder height.',
        'Keep your ribs down so the lower back does not arch.'],
      cues: ['Squeeze glutes lightly', 'Shoulders down, away from ears', 'Full reach at the top'],
      easier: 'Alternate one arm at a time.', harder: 'Add a slow squat as you press.',
      feel: 'Shoulders, triceps',
      frames: [P(STAND, { a: [[90, -90], [92, -88]] }), P(STAND, { a: [[-90, -90], [-88, -88]] })]
    },
    {
      id: 'front', name: 'Front Raise', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, w: true, use: ['main'],
      blurb: 'Lift the weights in front of you to shoulder height with straight arms.',
      steps: ['Stand tall with weights in front of your thighs.',
        'Exhale and raise both arms to shoulder height.',
        'Inhale and lower slowly.',
        'Stay tall and do not lean back.'],
      cues: ['Soft elbows', 'Neck long', 'Control the lowering'],
      easier: 'Go without weights.', harder: 'Hold at the top for 2 counts.',
      feel: 'Front shoulders',
      frames: [P(STAND, {}), P(STAND, { a: [[0, 0], [2, 2]] })]
    },
    {
      id: 'kickback', name: 'Triceps Kickback', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, w: true, use: ['main'],
      blurb: 'Hinge forward and extend the arms behind you to tone the back of the arms.',
      steps: ['Soften your knees and hinge forward from the hips with a flat back.',
        'Hold your elbows high beside your ribs, forearms hanging down.',
        'Exhale and straighten your arms back behind you.',
        'Inhale and bend the elbows back to 90°.'],
      cues: ['Upper arm stays still', 'Squeeze at the end', 'Spine long'],
      easier: 'Do one arm at a time, with a hand on your thigh.', harder: 'Pulse 5 times at the top.',
      feel: 'Triceps',
      frames: [{ h: [105, 57], t: -30, hd: -35, a: [[150, 90], [148, 92]], l: [[75, 105], [77, 103]] },
        { h: [105, 57], t: -30, hd: -35, a: [[150, 150], [148, 148]], l: [[75, 105], [77, 103]] }]
    },
    {
      id: 'dips', name: 'Triceps Dips', g: ['arms'], pos: 'seated', lvl: 2, kind: 'reps', tempo: 3, use: ['main'],
      blurb: 'Sit with hands behind you and bend the elbows straight back. No equipment needed.',
      steps: ['Sit with knees bent, feet flat, and hands on the mat behind your hips, fingers pointing forward.',
        'Lift your hips slightly off the floor.',
        'Inhale and bend your elbows straight back, lowering a few inches.',
        'Exhale and press up through your palms.'],
      cues: ['Elbows point back, not out', 'Shoulders away from ears', 'Keep hips close to your hands'],
      easier: 'Stay seated and use a smaller range.', harder: 'Extend one leg out straight.',
      feel: 'Triceps, shoulders',
      frames: [{ h: [111, 99.5], t: -101, hd: -95, a: [{ to: [100, 106], b: 1 }, { to: [96, 106], b: 1 }], l: [{ to: [162, 106], b: -1 }, { to: [168, 106], b: -1 }] },
        { h: [111, 105], t: -101, hd: -95, a: [{ to: [100, 106], b: 1 }, { to: [96, 106], b: 1 }], l: [{ to: [162, 106], b: -1 }, { to: [168, 106], b: -1 }] }]
    },
    {
      id: 'kneepush', name: 'Knee Push-Up', g: ['arms'], pos: 'quad', lvl: 2, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'A Pilates push-up from the knees. Keep your elbows tucked close to your ribs.',
      steps: ['Start on hands and knees, then walk your hands forward until your body is a straight line from knees to head.',
        'Inhale and bend your elbows straight back, lowering your chest.',
        'Exhale and press the floor away to straighten your arms.',
        'Hold your abs in so the hips do not sag.'],
      cues: ['Elbows brush your sides', 'One long line', 'Press, do not drop'],
      easier: 'Do it against a wall or a couch.', harder: 'Do the full push-up from your toes.',
      feel: 'Chest, triceps, core',
      frames: [{ h: [134.3, 87.8], t: -40.3, hd: -30, a: [[90, 90], [92, 92]], l: [[139.5, 200], [141, 198]] },
        { h: [127.5, 97.9], t: -16.9, hd: -10, a: [{ rel: [0, 18], b: 1 }, { rel: [0, 18], b: 1 }], l: [[163.1, 200], [165, 198]] }]
    },
    {
      id: 'pullover', name: 'Pullover', g: ['arms', 'abs'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 4, w: true, use: ['main'],
      blurb: 'Lower the weights overhead and pull them back up. It connects the arms, lats and abs.',
      steps: ['Lie on your back with knees bent, holding one weight (or a pair) over your chest.',
        'Inhale and lower the arms overhead while your ribs stay down.',
        'Exhale and use your abs and lats to bring them back up.',
        'Keep your elbows soft.'],
      cues: ['Do not let the ribs pop', 'Move from the shoulder', 'Smooth arc'],
      easier: 'Do it without weights.', harder: 'Lift your head and shoulders as you pull up.',
      feel: 'Lats, abs, triceps',
      frames: [P(SUPK, { a: [[-90, -90], [-88, -88]] }), P(SUPK, { a: [[200, 200], [203, 203]] })]
    },

    // ===== LEGS / GLUTES =====
    {
      id: 'bridge', name: 'Glute Bridge', g: ['legs'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 4, use: ['main', 'warm'], wo: 3,
      blurb: 'Peel your spine up one bone at a time to lift your hips. Mimics the reformer bridge on the mat.',
      steps: ['Lie on your back, knees bent, feet hip-width apart and arms by your sides.',
        'Exhale and tilt your pelvis, then peel your spine up into a diagonal line.',
        'Squeeze your glutes at the top without arching your low back.',
        'Inhale and roll down slowly from the upper back to the tailbone.'],
      cues: ['Press through your heels', 'Knees stay hip-width', 'Ribs stay soft'],
      easier: 'Lift only a little way and skip the hold.', harder: 'Pulse at the top 10 times.',
      feel: 'Glutes, hamstrings',
      frames: [BR_DN, BR_UP]
    },
    {
      id: 'slbridge', name: 'Single-Leg Bridge', g: ['legs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 4, sides: true, use: ['main'],
      blurb: 'A bridge with one leg lifted. This doubles the work for your standing-leg glute and hamstring.',
      steps: ['Set up in a bridge. Extend one leg long, in line with your thigh.',
        'Lower your hips a few inches and lift again, keeping the pelvis level.',
        'Stay tall in the hip of the working leg.',
        'Do all reps on one side, then switch.'],
      cues: ['Hips square', 'Push through the heel', 'Do not twist'],
      easier: 'Keep both feet down.', harder: 'Hold the top and pulse.',
      feel: 'Glutes, hamstrings, core',
      frames: [P(BR_DN, { l: [[-32, -32], { to: [188, 106], b: -1 }] }), P(BR_UP, { l: [[-32, -32], { to: [188, 106], b: -1 }] })]
    },
    {
      id: 'march', name: 'Bridge March', g: ['legs', 'abs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 3, use: ['main'],
      blurb: 'Hold a bridge and alternate lifting each knee. The hips must stay level.',
      steps: ['Lift into a bridge and hold it.',
        'Exhale and lift one knee toward your chest without letting the hips drop.',
        'Place the foot down and switch.',
        'Keep your glutes squeezed all the way through.'],
      cues: ['Level hips', 'Do not rush', 'Steady breath'],
      easier: 'March from a lower bridge height.', harder: 'Hold each lift for 2 counts.',
      feel: 'Glutes, deep abs',
      frames: [BR_UP, P(BR_UP, { l: [[-80, 0], { to: [190, 106], b: -1 }] })]
    },
    {
      id: 'sidelift', name: 'Side-Lying Leg Lift', g: ['legs'], pos: 'side', lvl: 1, kind: 'reps', tempo: 3, sides: true, use: ['main'],
      blurb: 'Lie on your side and lift the top leg. The outer hip and thigh do the work, just like the reformer side series.',
      steps: ['Lie on your side with your body in one line and your bottom arm under your head.',
        'Stack your hips and keep the top leg straight, toes forward.',
        'Exhale and lift the top leg to hip height, then lower with control.',
        'Do all reps, then switch sides.'],
      cues: ['Do not roll back', 'Lift from the hip', 'Long leg, soft foot'],
      easier: 'Bend the bottom knee for balance.', harder: 'Add 10 small circles at the top.',
      feel: 'Outer hip, glute',
      frames: [{ h: [150, 105], t: 180, hd: 180, a: [{ to: [142, 98], b: -1 }, [180, 180]], l: [[0, 0], [1, 1]] },
        { h: [150, 105], t: 180, hd: 180, a: [{ to: [142, 98], b: -1 }, [180, 180]], l: [[-35, -35], [1, 1]] }]
    },
    {
      id: 'donkey', name: 'Donkey Kick', g: ['legs'], pos: 'quad', lvl: 1, kind: 'reps', tempo: 3, sides: true, use: ['main'],
      blurb: 'On hands and knees, press the heel to the ceiling to fire up the glutes.',
      steps: ['Start on hands and knees with a flat back.',
        'Keep your knee bent at 90° and lift it behind you until the thigh is level with your back.',
        'Press your heel up toward the ceiling, squeezing the glute.',
        'Lower the knee without touching down, and repeat.'],
      cues: ['Hips stay square', 'Do not arch', 'Squeeze at the top'],
      easier: 'Lower the range and rest the knee between reps.', harder: 'Add a small pulse at the top.',
      feel: 'Glutes',
      frames: [QUAD, P(QUAD, { l: [[190, -80], [90, 180]] })]
    },
    {
      id: 'squat', name: 'Pilates Squat', g: ['legs'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'Feet hip-width, arms reaching long. Sit your hips back like a chair and rise tall.',
      steps: ['Stand with feet hip-width apart and arms forward.',
        'Inhale and sit your hips back and down, keeping your chest lifted.',
        'Exhale and press through your heels to stand tall.',
        'Squeeze your glutes at the top.'],
      cues: ['Knees track over toes', 'Heels stay heavy', 'Lengthen through the crown of the head'],
      easier: 'Do a shallow squat or use a chair.', harder: 'Hold the bottom and pulse 10 times.',
      feel: 'Quads, glutes',
      frames: [{ h: [120, 55], t: -90, a: [[0, 0], [2, 2]], l: [{ to: [120, 110], b: -1 }, { to: [120, 110], b: -1 }] },
        { h: [95, 82], t: -65, t2: -60, hd: -60, a: [[0, 0], [2, 2]], l: [{ to: [120, 110], b: -1 }, { to: [120, 110], b: -1 }] }]
    },
    {
      id: 'lunge', name: 'Reverse Lunge', g: ['legs'], pos: 'standing', lvl: 2, kind: 'reps', tempo: 4, sides: true, use: ['main'],
      blurb: 'Step back and lower straight down. A gentler lunge for the knees that fires the glutes and thighs.',
      steps: ['Stand tall with hands at your chest.',
        'Step one foot back and lower until both knees are about 90°.',
        'Keep your front knee over the ankle and your torso upright.',
        'Press through the front heel to stand. Do all reps, then switch.'],
      cues: ['Straight down, not forward', 'Tall chest', 'Back heel lifted'],
      easier: 'Hold a chair for balance and bend less.', harder: 'Add a pulse at the bottom or hold light weights.',
      feel: 'Glutes, quads',
      frames: [{ h: [112, 55], t: -90, a: [{ rel: [14, 8], b: 1 }, { rel: [14, 8], b: 1 }], l: [{ to: [112, 110], b: -1 }, { to: [112, 110], b: -1 }] },
        { h: [112, 83], t: -90, a: [{ rel: [14, 8], b: 1 }, { rel: [14, 8], b: 1 }], l: [[0, 90], [110, 190]] }]
    },
    {
      id: 'hamcurl', name: 'Prone Hamstring Curl', g: ['legs'], pos: 'prone', lvl: 1, kind: 'reps', tempo: 3, use: ['main'],
      blurb: 'Lie on your belly and bring your heel toward your glute. A reformer-style leg curl on the mat.',
      steps: ['Lie face down with your forehead resting on your hands.',
        'Tighten your belly and glutes.',
        'Exhale and bend one knee, bringing your heel toward your glute.',
        'Inhale and lower with control. Alternate legs.'],
      cues: ['Hips heavy', 'Pointed toes', 'Slow lower'],
      easier: 'Keep the movement small.', harder: 'Add a mini-pulse at the top.',
      feel: 'Hamstrings, glutes',
      frames: [{ h: [150, 106], t: 180, t2: 185, hd: 200, a: [{ to: [96, 100], b: 1 }, { to: [98, 100], b: 1 }], l: [[2, 2], [2, 2]] },
        { h: [150, 106], t: 180, t2: 185, hd: 200, a: [{ to: [96, 100], b: 1 }, { to: [98, 100], b: 1 }], l: [[2, -110], [2, 2]] }]
    },
    {
      id: 'glutekick', name: 'Standing Glute Kickback', g: ['legs'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, sides: true, use: ['main'],
      blurb: 'Hinge forward and sweep one leg straight back. A balance move for the glutes.',
      steps: ['Stand tall near a wall or chair for support.',
        'Hinge slightly forward and keep your standing knee soft.',
        'Exhale and lift one leg straight back to hip height.',
        'Lower without touching the floor and repeat. Switch sides after.'],
      cues: ['Square hips', 'Long spine', 'Do not swing'],
      easier: 'Keep a hand on the wall and lift lower.', harder: 'Pulse at the top for the last 10.',
      feel: 'Glutes, hamstrings',
      frames: [{ h: [120, 55], t: -90, a: [[0, 0], [2, 2]], l: [{ to: [120, 110], b: -1 }, { to: [120, 110], b: -1 }] },
        { h: [120, 55], t: -75, a: [[0, 0], [2, 2]], l: [[150, 150], { to: [120, 110], b: -1 }] }]
    },

    // ===== PILATES RING (magic circle) =====
    {
      id: 'ringsqueeze', name: 'Ring Knee Squeeze', g: ['legs', 'abs'], pos: 'supine', lvl: 1, kind: 'reps', tempo: 3, ring: true, use: ['main'],
      blurb: 'Squeeze the ring between your knees to light up the inner thighs and deep abs.',
      steps: ['Lie on your back, knees bent, feet flat. Place the ring between your knees.',
        'Exhale and squeeze the ring firmly, drawing your lower belly in.',
        'Inhale and ease off without letting the ring drop.',
        'Keep your hips level and your low back long.'],
      cues: ['Squeeze from the inner thighs', 'Ribs stay down', 'Slow and steady'],
      easier: 'Squeeze lightly and hold for 3 counts.', harder: 'Pulse the squeeze quickly for the last 10.',
      feel: 'Inner thighs, deep abs',
      frames: [P(SUPK, { ring: { at: 'knees', rx: 6, ry: 11 } }), P(SUPK, { ring: { at: 'knees', rx: 2.5, ry: 11 } })]
    },
    {
      id: 'ringbridge', name: 'Ring Bridge', g: ['legs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 4, ring: true, use: ['main'],
      blurb: 'A glute bridge with the ring between your knees. Squeeze as you lift for extra inner thigh and glute work.',
      steps: ['Lie on your back with the ring between your knees, feet flat.',
        'Squeeze the ring, then peel your spine up into a bridge.',
        'Hold the squeeze at the top and keep your hips level.',
        'Roll down slowly, one vertebra at a time.'],
      cues: ['Keep squeezing the whole time', 'Press through your heels', 'Do not let the knees fall out'],
      easier: 'Lift only part way up.', harder: 'Pulse the hips up and down 10 times at the top.',
      feel: 'Glutes, inner thighs',
      frames: [P(BR_DN, { ring: { at: 'knees', rx: 5, ry: 11 } }), P(BR_UP, { ring: { at: 'knees', rx: 3, ry: 11 } })]
    },
    {
      id: 'ringchest', name: 'Ring Chest Squeeze', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 3, ring: true, use: ['main'],
      blurb: 'Press your palms into the sides of the ring at chest height. A simple, burning move for the chest and arms.',
      steps: ['Stand tall and hold the ring between your palms at chest height, elbows wide.',
        'Exhale and squeeze the ring in, as if you could flatten it.',
        'Inhale and ease off a little, without letting go.',
        'Keep your shoulders down and your ribs knit together.'],
      cues: ['Press the palms evenly', 'Elbows lifted', 'Breathe out as you squeeze'],
      easier: 'Squeeze lightly and hold for 3 counts.', harder: 'Hold the squeeze and pulse 10 times.',
      feel: 'Chest, arms',
      frames: [P(STAND, { a: [{ rel: [24, 8], b: 1 }, { rel: [24, 8], b: 1 }], ring: { at: 'hands', rx: 8, ry: 9 } }), P(STAND, { a: [{ rel: [24, 8], b: 1 }, { rel: [24, 8], b: 1 }], ring: { at: 'hands', rx: 3, ry: 10 } })]
    },
    {
      id: 'ringohp', name: 'Ring Overhead Press', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 4, ring: true, use: ['main'],
      blurb: 'Hold the ring above your head and squeeze as you press up. It works the shoulders, upper arms and the sides of your waist.',
      steps: ['Stand tall and hold the ring in front of your chest.',
        'Exhale and press it overhead while squeezing in.',
        'Inhale and lower it back down, still squeezing lightly.',
        'Keep your ribs down so you do not arch.'],
      cues: ['Squeeze all the way up', 'Shoulders away from ears', 'Tall spine'],
      easier: 'Press only to the top of your head.', harder: 'Hold at the top for 3 breaths.',
      feel: 'Shoulders, triceps',
      frames: [P(STAND, { a: [{ to: [128, 2], b: 1 }, { to: [128, 2], b: 1 }], ring: { at: 'hands', rx: 8, ry: 9 } }), P(STAND, { a: [[-90, -90], [-88, -88]], ring: { at: 'hands', rx: 3, ry: 10, dy: -8 } })]
    },
    {
      id: 'ringhundred', name: 'Ring Hundred', g: ['abs'], pos: 'supine', lvl: 2, kind: 'hold', tempo: 1, ring: true, use: ['main'],
      blurb: 'The Hundred with the ring between your ankles. Squeezing it keeps your legs working while your abs hold you up.',
      steps: ['Lie on your back with the ring between your ankles and your legs at about 45°.',
        'Lift your head and shoulders and reach your arms long.',
        'Squeeze the ring and pump your arms in small beats.',
        'Inhale for 5 beats, exhale for 5.'],
      cues: ['Squeeze the ring the whole time', 'Low back stays heavy', 'Pump from the shoulder'],
      easier: 'Bend your knees into tabletop and put the ring between your knees.', harder: 'Lower your legs a little closer to the floor.',
      feel: 'Abs, inner thighs',
      frames: [P(SUP, { h: [145, 106], t: 180, t2: 205, hd: 208, a: [[8, 8], [8, 8]], l: [[-45, -45], [-42, -42]], ring: { at: 'ankles', rx: 3, ry: 8 } }),
        P(SUP, { h: [145, 106], t: 180, t2: 205, hd: 208, a: [[-6, -6], [-6, -6]], l: [[-45, -45], [-42, -42]], ring: { at: 'ankles', rx: 3, ry: 8 } })]
    },
    {
      id: 'ringlowers', name: 'Ring Leg Lowers', g: ['abs', 'legs'], pos: 'supine', lvl: 2, kind: 'reps', tempo: 4, ring: true, use: ['main'],
      blurb: 'Lower and lift your legs with the ring between your ankles. It adds inner thigh work to the lower abs.',
      steps: ['Lie on your back, legs straight up, ring between your ankles.',
        'Exhale and lower your legs as far as you can with your low back flat.',
        'Squeeze the ring the whole way.',
        'Exhale and lift your legs back up.'],
      cues: ['Squeeze, do not grip with the feet', 'Tailbone heavy', 'Slow lower'],
      easier: 'Only lower halfway.', harder: 'Hold the bottom for 3 counts.',
      feel: 'Lower abs, inner thighs',
      frames: [P(SUP, P(CURL, { h: [145, 106], a: [[8, 8], [8, 8]], l: [[-90, -90], [-92, -92]], ring: { at: 'ankles', rx: 3, ry: 8 } })),
        P(SUP, P(CURL, { h: [145, 106], a: [[8, 8], [8, 8]], l: [[-25, -25], [-22, -22]], ring: { at: 'ankles', rx: 3, ry: 8 } }))]
    },
    {
      id: 'ringside', name: 'Ring Side-Lying Lift', g: ['legs'], pos: 'side', lvl: 1, kind: 'reps', tempo: 3, sides: true, ring: true, use: ['main'],
      blurb: 'Hold the ring between your ankles in a side-lying lift. The squeeze adds inner thigh work to the outer hip lift.',
      steps: ['Lie on your side with your body in one line and the ring between your ankles.',
        'Squeeze the ring lightly and keep your hips stacked.',
        'Exhale and lift both legs a few inches, then lower with control.',
        'Do all reps, then switch sides.'],
      cues: ['Hips stacked', 'Lift from the waist', 'Do not roll back'],
      easier: 'Lift only the top leg and skip the ring.', harder: 'Add 10 small pulses at the top.',
      feel: 'Outer hip, inner thigh, waist',
      frames: [{ h: [150, 105], t: 180, hd: 180, a: [{ to: [142, 98], b: -1 }, [180, 180]], l: [[0, 0], [1, 1]], ring: { at: 'ankles', rx: 3, ry: 8 } },
        { h: [150, 105], t: 180, hd: 180, a: [{ to: [142, 98], b: -1 }, [180, 180]], l: [[-20, -20], [-14, -14]], ring: { at: 'ankles', rx: 3, ry: 8 } }]
    },

    // ===== FULL BODY / WARM-UP / COOL-DOWN =====
    {
      id: 'sweep', name: 'Standing Arm Sweeps', g: ['arms'], pos: 'standing', lvl: 1, kind: 'reps', tempo: 6, use: ['warm', 'cool'], wo: 1, co: 0,
      blurb: 'Sweep your arms forward and up while you grow tall. A gentle way to wake up the shoulders and posture.',
      steps: ['Stand tall with feet together, arms in front of your thighs.',
        'Inhale and sweep your arms forward and up overhead, lengthening through your spine.',
        'Exhale and float your arms back down with your ribs staying knit together.',
        'Keep your shoulders soft and your abs gently drawn in.'],
      cues: ['Grow taller as you lift', 'Shoulders down, away from ears', 'Smooth, slow breath'],
      easier: 'Keep your arms lower, only to shoulder height.', harder: 'Add a slow calf raise as your arms go up.',
      feel: 'Shoulders, posture',
      frames: [P(STAND, { a: [[80, 60], [82, 62]] }), P(STAND, { a: [[-90, -90], [-88, -88]] })]
    },
    {
      id: 'child', name: "Child's Pose", g: ['abs'], pos: 'quad', lvl: 1, kind: 'hold', tempo: 5, use: ['cool'], co: 4,
      blurb: 'Sit back on your heels and reach your arms long. A calming stretch for your back, hips and shoulders.',
      steps: ['Kneel and sit your hips back toward your heels.',
        'Fold forward and rest your forehead on the mat, arms long.',
        'Breathe into your back and feel the ribs widen.',
        'Stay for several slow breaths.'],
      cues: ['Soften the jaw', 'Melt into the floor', 'Long, slow exhale'],
      easier: 'Put a pillow between your hips and heels.', harder: 'Walk your hands to each side for a lat stretch.',
      feel: 'Back, hips (stretch)',
      frames: [P(QUAD, {}),
        { h: [78, 96], t: 5, t2: 15, hd: 30, a: [[5, 5], [7, 7]], l: [[21, 180], [21, 180]] }]
    },
    {
      id: 'pike', name: 'Plank to Pike', g: ['abs', 'arms'], pos: 'quad', lvl: 3, kind: 'reps', tempo: 4, use: ['main'],
      blurb: 'Glide from plank up into an upside-down V. Inspired by the reformer long stretch and pike.',
      steps: ['Start in a high plank, hands under shoulders, body in a line.',
        'Exhale and lift your hips up and back into a pike, pressing the floor away.',
        'Keep your legs as straight as you can and your head between your arms.',
        'Inhale and glide forward back to plank.'],
      cues: ['Hips up and back', 'Shoulders stacked over wrists', 'Pull your belly button to your spine'],
      easier: 'Do it from your knees or hold the pike.', harder: 'Add a push-up in the plank.',
      feel: 'Abs, shoulders, hamstrings',
      frames: [{ h: [139.6, 81.2], t: -26.7, hd: -26, a: [[90, 90], [92, 92]], l: [[153.3, 153.3], [153.3, 153.3]] },
        { h: [118, 58], t: 20.6, hd: 90, a: [{ to: [170, 106], b: 1 }, { to: [172, 106], b: 1 }], l: [[120, 120], [120, 120]] }]
    },
    {
      id: 'swan', name: 'Swan Prep', g: ['abs'], pos: 'prone', lvl: 1, kind: 'reps', tempo: 5, use: ['cool', 'main'], co: 1,
      blurb: 'A gentle back extension. It opens your chest and counters all the forward curling.',
      steps: ['Lie face down with hands under your shoulders and elbows tucked in.',
        'Inhale and slide your chest forward and up, pressing through your hands.',
        'Keep your legs together and your neck long.',
        'Exhale and lower down slowly.'],
      cues: ['Lengthen first, then lift', 'Shoulders away from ears', 'Keep hips on the mat'],
      easier: 'Stay low on your forearms.', harder: 'Lift higher with straight arms.',
      feel: 'Back, chest (stretch)',
      frames: [{ h: [100, 106], t: -3, hd: -3, a: [[-120, 70], [-118, 72]], l: [[180, 180], [180, 180]] },
        { h: [100, 106], t: -10, t2: -50, hd: -60, a: [{ to: [138, 106], b: 1 }, { to: [140, 106], b: 1 }], l: [[180, 180], [180, 180]] }]
    },
    {
      id: 'kneehug', name: 'Knee Hug', g: ['abs'], pos: 'supine', lvl: 1, kind: 'hold', tempo: 5, use: ['warm', 'cool'], wo: 4, co: 3,
      blurb: 'Hug your knees in and rock gently. A quiet reset for the low back.',
      steps: ['Lie on your back and hug both knees toward your chest.',
        'Relax your shoulders and rock gently side to side.',
        'Breathe slowly and let your low back release.',
        'Extend your legs long to finish.'],
      cues: ['Relax the neck', 'Small rocking', 'Slow breath'],
      easier: 'Hug one knee at a time.', harder: 'Lift your head to your knees for a gentle curl.',
      feel: 'Low back (stretch)',
      frames: [SUP, P(SUP, { t: 180, t2: 205, hd: 210, a: [{ to: [140, 88], b: -1 }, { to: [143, 90], b: -1 }], l: [[-125, 25], [-122, 28]] })]
    }
  ];

  var BY_ID = {};
  EX.forEach(function (e) { BY_ID[e.id] = e; });

  window.MD = { EX: EX, BY_ID: BY_ID, figures: figures };
})();
