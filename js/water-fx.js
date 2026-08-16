// ===================================================
// Yui Portfolio - water-fx.js
// 水しぶき（小水滴・細長い飛沫・波紋）の共通生成ユーティリティ。
// CTA水しぶき（js/cta-splash.js）とWorks水面浮上（js/works-reveal.js）の両方から使う。
// 要素の生成・GSAPでの飛散・完了後のDOM削除までをここで完結させる。
// GSAPが無い場合は何もしない（呼び出し側で存在確認する）。
// ===================================================
(function () {
  'use strict';

  function spawnDroplet(container, opts) {
    if (!window.gsap) return;
    opts = opts || {};
    var el = document.createElement('span');
    el.className = 'water-droplet';
    var w = opts.size || 3 + Math.random() * 4; // 3〜7px
    var h = w * (0.8 + Math.random() * 0.4);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = opts.x + 'px';
    el.style.top = opts.y + 'px';
    container.appendChild(el);

    var angle = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
    var distance = opts.distance != null ? opts.distance : 10 + Math.random() * 14;
    var dx = Math.cos(angle) * distance;
    var dy = Math.sin(angle) * distance;

    gsap.fromTo(
      el,
      { x: 0, y: 0, opacity: 0.85, scale: 1 },
      {
        x: dx,
        y: dy,
        opacity: 0,
        scale: 0.4,
        duration: opts.duration || 0.5 + Math.random() * 0.3,
        delay: opts.delay || 0,
        ease: 'sine.out',
        onComplete: function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      }
    );
  }

  function spawnStreak(container, opts) {
    if (!window.gsap) return;
    opts = opts || {};
    var el = document.createElement('span');
    el.className = 'water-streak';
    var h = opts.height || 8 + Math.random() * 10; // 8〜18px
    el.style.height = h + 'px';
    el.style.left = opts.x + 'px';
    el.style.top = opts.y + 'px';
    el.style.transform = 'rotate(' + (opts.rotate != null ? opts.rotate : -15 + Math.random() * 30) + 'deg)';
    container.appendChild(el);

    var rise = opts.rise != null ? opts.rise : 12 + Math.random() * 8;

    gsap.fromTo(
      el,
      { scaleY: 0.6, scaleX: 1, y: 0, opacity: 0.85 },
      {
        scaleY: 1.8,
        scaleX: 0.4,
        y: -rise,
        opacity: 0,
        duration: opts.duration || 0.4 + Math.random() * 0.2,
        delay: opts.delay || 0,
        ease: 'sine.out',
        onComplete: function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      }
    );
  }

  function spawnRipple(container, opts) {
    if (!window.gsap) return;
    opts = opts || {};
    var el = document.createElement('span');
    el.className = 'water-ripple' + (opts.wide ? ' water-ripple--wide' : '');
    el.style.left = opts.x + 'px';
    el.style.top = opts.y + 'px';
    container.appendChild(el);

    gsap.fromTo(
      el,
      { scale: 0, opacity: opts.peakOpacity != null ? opts.peakOpacity : 0.5 },
      {
        scale: opts.maxScale != null ? opts.maxScale : 3,
        opacity: 0,
        duration: opts.duration || 0.7,
        delay: opts.delay || 0,
        ease: 'power1.out',
        onComplete: function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      }
    );
  }

  window.WaterFX = {
    spawnDroplet: spawnDroplet,
    spawnStreak: spawnStreak,
    spawnRipple: spawnRipple
  };
})();
