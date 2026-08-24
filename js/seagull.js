// ===================================================
// Yui Portfolio - seagull.js
// 海鳥ナビゲーション（GSAP + ScrollTrigger + MotionPathPlugin）
//
// 設計方針：
// 「セクションからセクションへ長距離を飛ばす」のではなく、
// 各セクション内で「登場→横方向へ滑空→少しカーブ→退場」を完結させる。
// About / Flow の2シーンのみで登場し、Hero・Skills/Toolsでは登場させない
// （常時飛ばし続けないことで「案内役」の印象を保つ。Heroは指示によりあえて飛ばさない）。
//
// 読み込み時イントロ（js/intro.js）は瓶が波で流れ着く演出のため、
// この海鳥とは無関係。ただしイントロが閉じるまではHero等の演出も始めたくないため、
// js/intro.js側がゲートを閉じたタイミングでwindow.SeagullFlight.init()を呼び、
// ここでシーン監視を開始する（js/water-fx.jsのwindow.WaterFXと同様の公開パターン）。
//
// 他の演出（雲の浮遊・シーグラスhover・Flow波線）はvanilla JS/CSSのみで、GSAPはここでしか使わない。
// ===================================================
(function () {
  'use strict';

  var seagull = document.getElementById('seagull');
  if (!seagull) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // 表示させない（デフォルトのopacity:0のまま）

  if (!window.gsap || !window.ScrollTrigger || !window.MotionPathPlugin) return;
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

  // ---------- 羽ばたき：常時パタパタさせず、「登場時」「方向転換時」だけ短く羽ばたき、
  //            それ以外は滑空版（seagull-glide.png）を使う ----------
  var glideFrame = seagull.querySelector('.seagull__frame--glide');
  var flapFrame = seagull.querySelector('.seagull__frame--flap');

  function setGlide() {
    flapFrame.classList.remove('is-visible');
    glideFrame.classList.add('is-visible');
  }

  function setFlap() {
    glideFrame.classList.remove('is-visible');
    flapFrame.classList.add('is-visible');
  }

  function flapBurst(times) {
    var i = 0;
    function tick() {
      if (i % 2 === 0) setFlap(); else setGlide();
      i += 1;
      if (i < times) {
        setTimeout(tick, 180);
      } else {
        setTimeout(setGlide, 180);
      }
    }
    tick();
  }

  // ---------- 常時ゆるやかな回転の揺れ（-4deg〜4deg。急降下姿勢にはならない範囲） ----------
  gsap.to(seagull, {
    rotation: 4,
    duration: 2.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  });

  var desktopMql = window.matchMedia('(min-width: 768px)');
  var flightTimeline = null;

  function setBasePosition(x, y) {
    seagull.style.left = x + 'px';
    seagull.style.top = y + 'px';
    gsap.set(seagull, { x: 0, y: 0 });
  }

  function docRect(el) {
    var r = el.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      right: r.right + window.scrollX,
      bottom: r.bottom + window.scrollY,
      width: r.width,
      height: r.height
    };
  }

  // 横方向優先の緩いS字カーブ（進行方向に対して垂直に、控えめな振れ幅でオフセット）
  function buildCurvePath(dx, dy) {
    var nx = -dy;
    var ny = dx;
    var len = Math.sqrt(nx * nx + ny * ny) || 1;
    var wig = Math.min(60, len * 0.14);
    var offX = (nx / len) * wig;
    var offY = (ny / len) * wig;
    var p1x = dx * 0.33 + offX;
    var p1y = dy * 0.33 + offY;
    var p2x = dx * 0.66 - offX;
    var p2y = dy * 0.66 - offY;
    return (
      'M0,0' +
      ' C' + p1x + ',' + p1y + ' ' + (dx * 0.5) + ',' + (dy * 0.35) + ' ' + (dx * 0.5) + ',' + (dy * 0.5) +
      ' C' + p2x + ',' + p2y + ' ' + (dx * 0.85) + ',' + (dy * 0.9) + ' ' + dx + ',' + dy
    );
  }

  function hideSeagull() {
    gsap.to(seagull, {
      opacity: 0,
      duration: 1.2,
      delay: 0.4,
      onComplete: function () {
        seagull.classList.remove('is-active');
        gsap.set(seagull, { willChange: 'auto' });
      }
    });
  }

  // ---------- シーン定義（各セクション内で完結する短い飛行） ----------
  // dx: 横移動量（500〜900px目安）/ dy: 縦移動量（50〜180px目安、真下移動は作らない）
  function aboutConfig() {
    var row = document.querySelector('.concept-about-row') || document.querySelector('#about');
    if (!row) return null;
    var r = docRect(row);
    return {
      start: { x: r.left - 30, y: r.top + r.height * 0.1 },
      dx: 780, dy: 70,
      duration: 5,
      scaleFrom: 0.78, scaleMid: 0.98, scaleTo: 0.8
    };
  }

  function flowConfig() {
    var route = document.querySelector('#flow .flow__route') || document.querySelector('#flow');
    if (!route) return null;
    var r = docRect(route);
    return {
      start: { x: r.left - 30, y: r.top + r.height * 0.45 },
      dx: 720, dy: 65,
      duration: 5,
      scaleFrom: 0.78, scaleMid: 0.96, scaleTo: 0.78
    };
  }

  // Hero・Skills / Tools はあえてシーンを作らない（Heroには飛ばさない指示・海鳥がいない時間を作る）
  var scenes = [
    { key: 'about', trigger: '#about', build: aboutConfig, mobileEl: '#about .section-heading__jp' },
    { key: 'flow', trigger: '#flow', build: flowConfig, mobileEl: '#flow .section-heading__jp' }
  ];

  // PC/タブレット：1セクション内で完結する短い滑空（登場→滑空→少しカーブ→退場）
  function flyScene(cfg) {
    if (!cfg) return;
    if (flightTimeline && flightTimeline.isActive()) return;

    setBasePosition(cfg.start.x, cfg.start.y);
    gsap.set(seagull, { scale: cfg.scaleFrom, opacity: 1, willChange: 'transform' });
    seagull.classList.add('is-active');
    setGlide();

    var path = buildCurvePath(cfg.dx, cfg.dy);
    var ease = 'sine.inOut';

    flightTimeline = gsap.timeline({ onComplete: hideSeagull });
    flightTimeline.call(function () { flapBurst(4); }, null, 0);

    if (cfg.slowMidRatio) {
      // パスを3分割し、中間区間だけ時間配分を増やして「少しだけ」速度を落とす。
      // 区間の継ぎ目でsine.inOutを重ねると速度がゼロまで落ちてから再加速する「継ぎ目」が
      // 生まれてカクついて見えるため、前後の速度が繋がるsine.out→（中間）→sine.inの組にする。
      var segA = 0.38, segB = 0.62;
      var midRatio = cfg.slowMidRatio;
      var d2 = cfg.duration * midRatio;
      var dRest = cfg.duration - d2;
      var d1 = dRest * (segA / (segA + (1 - segB)));
      var d3 = dRest - d1;

      flightTimeline
        .to(seagull, { motionPath: { path: path, start: 0, end: segA, curviness: 1.2 }, duration: d1, ease: 'sine.out' }, 0)
        .call(function () { flapBurst(2); })
        .to(seagull, { motionPath: { path: path, start: segA, end: segB, curviness: 1.2 }, duration: d2, ease: 'none' }, '>')
        .to(seagull, { motionPath: { path: path, start: segB, end: 1, curviness: 1.2 }, duration: d3, ease: 'sine.in' }, '>');
    } else {
      flightTimeline
        .to(seagull, { motionPath: { path: path, curviness: 1.2 }, duration: cfg.duration, ease: ease }, 0)
        .call(function () { flapBurst(2); }, null, cfg.duration * 0.5);
    }

    // 奥行き（scale）：前半sine.out（中間へ滑らかに減速して到達）→後半sine.in（中間から滑らかに加速して離れる）
    // にすることで、中間地点で速度が繋がり「止まって再加速」する継ぎ目をなくす
    flightTimeline.to(seagull, { scale: cfg.scaleMid, duration: cfg.duration * 0.5, ease: 'sine.out' }, 0);
    flightTimeline.to(seagull, { scale: cfg.scaleTo, duration: cfg.duration * 0.5, ease: 'sine.in' }, cfg.duration * 0.5);
  }

  // スマホ：飛行はさせず、見出し付近にふわっと現れてしばらくしてから消える簡略版
  function flashNear(scene) {
    var el = document.querySelector(scene.mobileEl) || document.querySelector(scene.trigger);
    if (!el) return;
    var r = docRect(el);
    setBasePosition(r.left + r.width * 0.6, r.top - 30);
    gsap.set(seagull, { scale: 0.9, opacity: 1 });
    seagull.classList.add('is-active');
    setGlide();
    hideSeagull();
  }

  var observers = [];
  function initScenes() {
    observers.forEach(function (o) { o.disconnect(); });
    observers = [];

    scenes.forEach(function (scene) {
      var target = document.querySelector(scene.trigger);
      if (!target) return;
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            if (desktopMql.matches) {
              flyScene(scene.build());
            } else {
              flashNear(scene);
            }
          });
        },
        { threshold: 0.35 }
      );
      io.observe(target);
      observers.push(io);
    });
  }

  desktopMql.addEventListener('change', function () {
    if (flightTimeline) flightTimeline.kill();
    gsap.set(seagull, { x: 0, y: 0, scale: 1, opacity: 0, willChange: 'auto' });
    seagull.classList.remove('is-active');
  });

  // js/water-fx.jsのwindow.WaterFXと同様の公開パターン。
  // js/intro.jsがイントロゲートを閉じたタイミングでinit()を呼び、
  // Hero/About/Flowの通常シーン監視を開始する
  window.SeagullFlight = {
    init: initScenes
  };
})();
