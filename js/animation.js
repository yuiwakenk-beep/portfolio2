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

  // ---------- 制作の流れ：ステップをつなぐ波線を、画面内にある間だけ定期的にトレースする ----------
  // 以前はスクロール量に連動して1回だけ描画していたが、今回は「1→7を繰り返しなぞる」
  // 周期的なアニメーションに変更。CSS側（.flow.is-flowing .flow__route-path）が
  // 実際のループ描画を担当し、ここではSVGパスの実寸（getTotalLength）をstroke-dasharray/
  // --flow-path-lengthとして渡すのと、Flowセクションが画面内にあるかどうかの判定だけを行う。
  const flowSection = document.querySelector('.flow');
  const flowPaths = document.querySelectorAll('.flow__route-path');

  if (flowSection && flowPaths.length) {
    const pathLengths = new Map();

    function preparePath(path) {
      if (pathLengths.has(path)) return pathLengths.get(path);
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch (e) {
        length = 0;
      }
      pathLengths.set(path, length);
      path.style.strokeDasharray = String(length);
      path.style.setProperty('--flow-path-length', String(length));
      return length;
    }

    // 768px境界でCSS表示が横/縦パスに切り替わるため、実際に表示されている方を都度判定する
    function activeFlowPath() {
      for (let i = 0; i < flowPaths.length; i++) {
        if (flowPaths[i].getClientRects().length) return flowPaths[i];
      }
      return null;
    }

    function prepareActivePath() {
      const path = activeFlowPath();
      if (path) preparePath(path);
    }

    if (reduceMotion) {
      // 動きを減らす設定では周期アニメーションを止め、線は最初から描き終わった状態で固定する
      flowPaths.forEach(function (path) {
        preparePath(path);
        path.style.strokeDashoffset = '0';
      });
    } else {
      prepareActivePath();
      window.addEventListener('resize', prepareActivePath);

      if ('IntersectionObserver' in window) {
        const flowObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            flowSection.classList.toggle('is-flowing', entry.isIntersecting);
          });
        }, { threshold: 0.2 });
        flowObserver.observe(flowSection);
      } else {
        flowSection.classList.add('is-flowing');
      }
    }
  }
})();
