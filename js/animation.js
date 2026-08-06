// ===================================================
// Yui Portfolio - animation.js
// スクロールフェードアップ（IntersectionObserver）/ 航路ライン描画
// ===================================================
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- フェードアップ表示 ----------
  const revealTargets = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  // ---------- 制作の流れ：航路ラインの描画 ----------
  const routePath = document.getElementById('flowRoutePath');

  if (routePath) {
    if (reduceMotion) {
      routePath.classList.add('is-drawn');
    } else if ('IntersectionObserver' in window) {
      const routeObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            routePath.classList.add('is-drawn');
            routeObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.3 }
      );
      routeObserver.observe(routePath);
    } else {
      routePath.classList.add('is-drawn');
    }
  }
})();
