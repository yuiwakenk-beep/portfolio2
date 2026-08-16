// ===================================================
// Yui Portfolio - cta-splash.js
// 「制作実績を見る」CTAの水しぶき演出（GSAP + js/water-fx.js）
// 浮き・scale・反射光は css/animation.css の .seaglass-hover が担当済みのため、
// ここでは水滴・飛沫・波紋の3種類による水しぶきのみを追加する。
// hover＝「水面に指を触れた」程度、click＝「水面を軽く叩いた」程度に強度を分ける。
// 他の演出（雲・シーグラスhover本体・Flow波線・海鳥）には触れない。
// ===================================================
(function () {
  'use strict';

  var cta = document.querySelector('.hero-cta--works');
  if (!cta) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  if (!window.gsap || !window.WaterFX) return;

  // ---------- hover：水面に指を触れた程度の、ごく弱い水しぶき ----------
  var lastSpawn = 0;
  var COOLDOWN_MS = 400;

  function spawnBurst(intensity, origin) {
    var rect = cta.getBoundingClientRect();

    // A. 小さな水滴
    var dropletCount = intensity === 'click' ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2); // click:4〜6 / hover:2〜3
    for (var i = 0; i < dropletCount; i++) {
      var startX = rect.width * (0.25 + Math.random() * 0.7);
      var startY = rect.height * (0.15 + Math.random() * 0.3);
      WaterFX.spawnDroplet(cta, {
        x: startX,
        y: startY,
        angle: (-100 + Math.random() * 80) * (Math.PI / 180), // ほぼ上〜斜め上
        distance: 10 + Math.random() * 14
      });
    }

    // B. 細長い飛沫（上方向へ伸びて消える）
    var streakCount = intensity === 'click' ? 2 + Math.floor(Math.random() * 2) : Math.random() < 0.6 ? 1 : 0; // click:2〜3 / hover:0〜1
    for (var s = 0; s < streakCount; s++) {
      var sx = rect.width * (0.3 + Math.random() * 0.5);
      var sy = rect.height * (0.2 + Math.random() * 0.25);
      WaterFX.spawnStreak(cta, { x: sx, y: sy, rotate: -18 + Math.random() * 36 });
    }

    // C. 波紋（hoverは非常に弱く1個だけ、clickは2重）。クリック時は実際にクリックした位置を起点にする
    var cx = origin ? origin.x : rect.width * 0.5;
    var cy = origin ? origin.y : rect.height * 0.55;
    if (intensity === 'click') {
      WaterFX.spawnRipple(cta, { x: cx, y: cy, maxScale: 3.4, peakOpacity: 0.85, duration: 0.7 });
      WaterFX.spawnRipple(cta, { x: cx, y: cy, maxScale: 3.4, peakOpacity: 0.85, duration: 0.7, delay: 0.08 });
    } else {
      WaterFX.spawnRipple(cta, { x: cx, y: cy, maxScale: 1.4, peakOpacity: 0.3, duration: 0.6 });
    }
  }

  cta.addEventListener('pointerenter', function () {
    var now = Date.now();
    if (now - lastSpawn < COOLDOWN_MS) return;
    lastSpawn = now;
    spawnBurst('hover');
  });

  // ---------- click：水面を軽く叩いた程度。preventDefaultはしない（既存のアンカー遷移・smooth scrollを維持） ----------
  cta.addEventListener('click', function (e) {
    var rect = cta.getBoundingClientRect();
    spawnBurst('click', { x: e.clientX - rect.left, y: e.clientY - rect.top });
  });
})();
