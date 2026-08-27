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

    // 追加：メニューからのアンカージャンプ等、高速スクロールでIntersectionObserverの
    // 判定フレームを飛び越えてしまい、一度も交差を検知できないまま画面内に到達する要素を救済する。
    // スクロールが止まったタイミングで、まだ表示されていない.revealのうち
    // 実際に画面内（またはその近く）にあるものを直接チェックして表示する
    function sweepReveal() {
      document.querySelectorAll('.reveal:not(.is-visible)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.1 && r.bottom > -window.innerHeight * 0.1) {
          el.classList.add('is-visible');
        }
      });
    }

    var sweepTimer = null;
    window.addEventListener('scroll', function () {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweepReveal, 150);
    }, { passive: true });

    // ハッシュ付きリンク（ナビゲーション・スキップリンク等）でのジャンプ直後にも念のため実行
    window.addEventListener('hashchange', function () {
      setTimeout(sweepReveal, 400);
    });
  }

  // ---------- 制作の流れ：ステップをつなぐ波線をスクロール量に連動して描画 ----------
  // 進捗の計算（getFlowScrollProgress）と、パスへの反映（applyFlowLineProgress）を分離している。
  // 将来GSAP ScrollTriggerに差し替える場合は、下のscroll/resizeリスナー（ドライバ部分）だけを
  // ScrollTrigger({ trigger: flowSection, scrub: true, onUpdate: self => applyFlowLineProgress(self.progress) })
  // に置き換えれば、applyFlowLineProgress以降のロジックはそのまま使える。
  const flowSection = document.querySelector('.flow');
  const flowPaths = document.querySelectorAll('.flow__route-path');

  if (flowSection && flowPaths.length) {
    const pathLengths = new Map();

    function getPathLength(path) {
      if (!pathLengths.has(path)) {
        let length = 0;
        try {
          length = path.getTotalLength();
        } catch (e) {
          length = 0;
        }
        pathLengths.set(path, length);
        path.style.strokeDasharray = String(length);
      }
      return pathLengths.get(path);
    }

    // 768px境界でCSS表示が横/縦パスに切り替わるため、実際に表示されている方を都度判定する
    function activeFlowPath() {
      for (let i = 0; i < flowPaths.length; i++) {
        if (flowPaths[i].getClientRects().length) return flowPaths[i];
      }
      return null;
    }

    function applyFlowLineProgress(progress) {
      const path = activeFlowPath();
      if (!path) return;
      const length = getPathLength(path);
      path.style.strokeDashoffset = String(length * (1 - progress));
    }

    function getFlowScrollProgress() {
      const rect = flowSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const raw = (vh - rect.top) / vh;
      return Math.min(1, Math.max(0, raw));
    }

    if (reduceMotion) {
      applyFlowLineProgress(1);
    } else {
      let flowTicking = false;
      const onFlowScroll = function () {
        if (flowTicking) return;
        flowTicking = true;
        requestAnimationFrame(function () {
          applyFlowLineProgress(getFlowScrollProgress());
          flowTicking = false;
        });
      };
      window.addEventListener('scroll', onFlowScroll, { passive: true });
      window.addEventListener('resize', onFlowScroll);
      onFlowScroll();
    }
  }
})();
