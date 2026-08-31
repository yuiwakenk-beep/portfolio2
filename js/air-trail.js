// ===================================================
// Yui Portfolio - air-trail.js
// ページ全体で統一するマウス軌跡「飛行機雲」演出。
// Hero〜Contactでマウスを動かした時だけ、カーソルの後ろに細く柔らかい光の筋が生まれ、
// 古い部分から膨らみながら空気へ溶けるように消える。常駐オブジェクトは持たず、
// pointermoveのたびに座標点を配列へ追加し、寿命（年齢・累積長）を超えた点から間引く方式。
// 昼（About〜Skills）の太陽光マウス追従・夕暮れ（Tools〜Contact）のキラッ演出は今回廃止し、
// マウスに反応する演出はこのファイルへ一本化した。Footerの波紋・水しぶき（js/footer-night.js）
// とは役割が競合するため、Footerへ近づくにつれて新規生成を弱め、水面上では新規生成を止める
// （既存の軌跡はそのまま自然減衰させ、唐突には消さない）。
// hoverできる機器（PC/タブレットのマウス操作）かつprefers-reduced-motionを希望しない場合のみ動作する。
// ===================================================
(function () {
  'use strict';

  var canvas = document.getElementById('airTrailCanvas');
  if (!canvas) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // スマホ・タブレットでは軌跡を生成しない

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ---------- 軌跡の寿命・見た目パラメータ ----------
  var MAX_AGE_MS = 1400; // 一点あたりの寿命（0.8〜1.8秒の目安の中央値）
  var MIN_POINT_SPACING = 7; // 直前の記録点からこれ以上動いた場合のみ新しい点を追加（カクつき防止と点数の間引きを兼ねる）
  var MAX_TRAIL_LENGTH = 480; // 軌跡の累積長の上限（px）。速く動かしても400〜500px程度で頭打ちにする
  var MAX_POINTS = 110; // 万一の保険的な点数上限
  var FOOTER_FADE_MARGIN = 160; // Footer手前このpx分から徐々に弱め始める

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var cssWidth = window.innerWidth;
  var cssHeight = window.innerHeight;

  function resizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cssWidth = window.innerWidth;
    cssHeight = window.innerHeight;
    canvas.width = Math.round(cssWidth * DPR);
    canvas.height = Math.round(cssHeight * DPR);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    // 累積せず常にリセットしてから拡大率をかけ直す（リサイズを繰り返しても二重に拡大されない）
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resizeCanvas();

  var resizeRaf = null;
  window.addEventListener('resize', function () {
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = null;
      resizeCanvas();
      updateFooterRects();
    });
  });

  // ---------- Footer手前でのフェードアウト用に、Footer/水面の位置をキャッシュする ----------
  // pointermoveのたびにgetBoundingClientRectを呼ぶとレイアウト再計算のコストがかさむため、
  // scroll/resize時だけ更新する（js/main.jsの既存passiveスクロール方針を踏襲）
  var footerEl = document.querySelector('.site-footer');
  var waterEl = footerEl ? footerEl.querySelector('.footer-night__water') : null;
  var footerTopY = Infinity;
  var waterTopY = Infinity;

  function updateFooterRects() {
    if (!footerEl) return;
    footerTopY = footerEl.getBoundingClientRect().top;
    waterTopY = waterEl ? waterEl.getBoundingClientRect().top : footerTopY;
  }
  updateFooterRects();
  window.addEventListener('scroll', updateFooterRects, { passive: true });

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // Footer上部でまだ少し残り、水面上では新規生成しない、という段階的な強度（1=通常, 0=生成しない）
  function spawnIntensityAt(clientY) {
    if (!footerEl) return 1;
    var fadeStart = footerTopY - FOOTER_FADE_MARGIN;
    if (clientY <= fadeStart) return 1;
    if (clientY >= waterTopY) return 0;
    var span = waterTopY - fadeStart;
    if (span <= 0) return 0;
    return clamp(1 - (clientY - fadeStart) / span, 0, 1);
  }

  // ---------- 座標点の管理 ----------
  var points = [];
  var fragments = []; // ごく小さな霧の断片（任意演出）。同時に数個程度まで
  var lastX = null, lastY = null, lastT = 0;
  var rafId = null;

  function ensureLoop() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function pruneStalePoints(now) {
    while (points.length && (now - points[0].t) > MAX_AGE_MS) points.shift();
    for (var i = fragments.length - 1; i >= 0; i--) {
      if (now - fragments[i].t > fragments[i].life) fragments.splice(i, 1);
    }
  }

  // 累積長がMAX_TRAIL_LENGTHを超えた分だけ、古い側から間引く
  function trimByLength() {
    var total = 0;
    for (var i = points.length - 1; i > 0; i--) {
      var dx = points[i].x - points[i - 1].x;
      var dy = points[i].y - points[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
      if (total > MAX_TRAIL_LENGTH) {
        points.splice(0, i);
        return;
      }
    }
  }

  function maybeSpawnFragment(x, y, now, intensity) {
    // 軌跡本体とは別に、ごく低確率・ごく小さな霧の断片を最大3個までだけ漂わせる（任意の高品質化演出）
    if (fragments.length >= 3) return;
    if (intensity < 0.6) return;
    if (Math.random() > 0.05) return;
    var angle = Math.random() * Math.PI * 2;
    var dist = 4 + Math.random() * 6;
    fragments.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      t: now,
      life: 500 + Math.random() * 200,
      size: 2 + Math.random() * 2
    });
  }

  function addPoint(x, y, now, speed, intensity) {
    points.push({
      x: x,
      y: y,
      t: now,
      speed: speed, // px/ms
      intensity: intensity,
      jitter: 0.85 + Math.random() * 0.3 // 生成時に一度だけ決める不規則さ（毎フレーム変化させず、ちらつきを防ぐ）
    });
    if (points.length > MAX_POINTS) points.shift();
    trimByLength();
    maybeSpawnFragment(x, y, now, intensity);
  }

  window.addEventListener('pointermove', function (e) {
    if (document.documentElement.classList.contains('intro-pending')) return; // イントロ中は生成しない

    var x = e.clientX, y = e.clientY;
    var now = performance.now();
    var intensity = spawnIntensityAt(y);

    if (intensity <= 0.02) {
      // 水面上など生成しない領域では、次に生成領域へ戻った時に長い直線でつながらないよう基準点をリセットする
      lastX = null;
      lastY = null;
      return;
    }

    if (lastX !== null) {
      var dx = x - lastX, dy = y - lastY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN_POINT_SPACING) return;
      var dt = Math.max(now - lastT, 1);
      addPoint(x, y, now, dist / dt, intensity);
    } else {
      addPoint(x, y, now, 0, intensity);
    }

    lastX = x;
    lastY = y;
    lastT = now;
    ensureLoop();
  });

  // ---------- 描画 ----------
  var LAYERS = [
    // 外側：ほぼ透明な柔らかい霧
    { color: '180,201,214', baseAlpha: 0.14, baseWidth: 4, maxWidth: 8.5, blur: 6, ageBoost: 1 },
    // 中間：ごく薄いぼかしの本体
    { color: '198,222,232', baseAlpha: 0.34, baseWidth: 2.6, maxWidth: 5.5, blur: 2, ageBoost: 1 },
    // 中心：比較的はっきりした細い青白いライン（老化で早めに減衰させ、先端ほど「はっきり」感を出す）
    { color: '225,240,246', baseAlpha: 0.55, baseWidth: 1.7, maxWidth: 2.7, blur: 0, ageBoost: 1.35 }
  ];

  function ageFraction(p, now) {
    return Math.min(1, (now - p.t) / MAX_AGE_MS);
  }

  function drawLayer(now, cfg) {
    if (points.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = cfg.blur;
    ctx.shadowColor = cfg.blur ? 'rgba(' + cfg.color + ',0.5)' : 'transparent';

    for (var i = 0; i < points.length; i++) {
      var p0 = points[Math.max(i - 1, 0)];
      var p1 = points[i];
      var p2 = points[Math.min(i + 1, points.length - 1)];

      var af = ageFraction(p1, now);
      var envelope = Math.max(0, 1 - af * cfg.ageBoost);
      if (envelope <= 0) continue;

      var speedNorm = Math.min(1, p1.speed / 1.1);
      var velFactor = 1.15 - 0.35 * speedNorm; // ゆっくり＝やや太く柔らかく、速い＝やや細く

      var width = (cfg.baseWidth + (cfg.maxWidth - cfg.baseWidth) * af) * velFactor * p1.jitter;
      var alpha = cfg.baseAlpha * envelope * p1.intensity * p1.jitter;
      if (width <= 0.05 || alpha <= 0.01) continue;

      var m1x = (p0.x + p1.x) / 2, m1y = (p0.y + p1.y) / 2;
      var m2x = (p1.x + p2.x) / 2, m2y = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(m1x, m1y);
      ctx.quadraticCurveTo(p1.x, p1.y, m2x, m2y);
      ctx.lineWidth = width;
      ctx.strokeStyle = 'rgba(' + cfg.color + ',1)';
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawFragments(now) {
    for (var i = 0; i < fragments.length; i++) {
      var f = fragments[i];
      var t = (now - f.t) / f.life;
      if (t >= 1) continue;
      var alpha = (1 - t) * 0.4;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(210,230,238,' + alpha.toFixed(3) + ')';
      ctx.shadowBlur = 3;
      ctx.shadowColor = 'rgba(210,230,238,0.5)';
      ctx.arc(f.x, f.y, f.size * (0.6 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function tick() {
    var now = performance.now();
    pruneStalePoints(now);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    for (var i = 0; i < LAYERS.length; i++) drawLayer(now, LAYERS[i]);
    drawFragments(now);

    if (points.length > 0 || fragments.length > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null; // 何も残っていない間はループを止め、次のpointermoveで再開する
    }
  }
})();
