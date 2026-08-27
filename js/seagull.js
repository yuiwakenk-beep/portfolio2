// ===================================================
// Yui Portfolio - seagull.js
// 海鳥ナビゲーション（GSAP + ScrollTrigger + MotionPathPlugin）
//
// 設計方針：
// 「セクションからセクションへ長距離を飛ばす」のではなく、
// 各セクション内・セクションの境目で「登場→横方向へ滑空→少しカーブ→退場」を完結させる。
// About / Skills-Toolsの境目 / Flow の3シーンで登場し、Heroでは登場させない
// （Heroは指示によりあえて飛ばさない）。
// Skills-Toolsは「対応できること」のカード群末尾と「使用ツール」の見出しの間にできる
// 余白帯を飛行帯にし、カードやチップ・見出し文字に被らないようにしている。
//
// 加えて、ページ最下部（夜の海Footer）に到達したときだけ、案内役の海鳥が最後に静かに
// 遠くへ去っていく「エンディング・フライト」を1セッション1回だけ再生する（STEP4）。
// 他の3シーンは横方向中心・何度でも再生されるのに対し、エンディングは
// 「やや上方向へ抜けながら縮小・フェード」「一度きり」という別ロジックのため、
// initScenes()とは独立したinitEndingScene()として実装している。
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
  //            それ以外は滑空版（seagull-glide.png）を使う。
  //            右→左へ飛ぶシーン用に左向きフレーム（-revサフィックス）も用意し、
  //            進行方向に応じてどちらのフレーム組を使うか切り替える ----------
  var glideFrame = seagull.querySelector('.seagull__frame--glide');
  var flapFrame = seagull.querySelector('.seagull__frame--flap');
  var glideRevFrame = seagull.querySelector('.seagull__frame--glide-rev');
  var flapRevFrame = seagull.querySelector('.seagull__frame--flap-rev');
  var allFrames = [glideFrame, flapFrame, glideRevFrame, flapRevFrame];

  function showFrame(frame) {
    allFrames.forEach(function (f) { f.classList.remove('is-visible'); });
    frame.classList.add('is-visible');
  }

  function setGlide(reversed) {
    showFrame(reversed ? glideRevFrame : glideFrame);
  }

  function setFlap(reversed) {
    showFrame(reversed ? flapRevFrame : flapFrame);
  }

  function flapBurst(times, reversed) {
    var i = 0;
    function tick() {
      if (i % 2 === 0) setFlap(reversed); else setGlide(reversed);
      i += 1;
      if (i < times) {
        setTimeout(tick, 180);
      } else {
        setTimeout(function () { setGlide(reversed); }, 180);
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

  // 「対応できること」のカード群末尾と「使用ツール」の見出しの間にできる余白帯
  // （それぞれのsection-innerのpadding-bottom/padding-top分の空き）だけを飛行帯にする。
  // カード・チップ・見出し文字のどれにも被らない。
  // このシーンだけ右端から出現して左へ飛ばしたいため、開始位置を右側に、
  // dxを負値にして進行方向を反転し、左向きフレーム（reversed）を使う
  function skillsToolsGapConfig() {
    var skillsGrid = document.querySelector('#skills .skills__grid');
    var toolsHeading = document.querySelector('#tools .section-heading');
    if (!skillsGrid || !toolsHeading) return null;
    var gRect = docRect(skillsGrid);
    var hRect = docRect(toolsHeading);
    var y = (gRect.bottom + hRect.top) / 2;
    return {
      start: { x: gRect.right + 30, y: y },
      dx: -780, dy: 24,
      duration: 5,
      scaleFrom: 0.78, scaleMid: 0.96, scaleTo: 0.8,
      reversed: true
    };
  }

  // ステップカード（.flow__route-wrap）のエリアは避け、.flow__note より下の
  // セクション下部の余白帯（次セクションとの間の padding-bottom 部分）を飛行帯にする
  function flowConfig() {
    var note = document.querySelector('#flow .flow__note') || document.querySelector('#flow');
    if (!note) return null;
    var r = docRect(note);
    return {
      start: { x: r.left - 30, y: r.bottom + 30 },
      dx: 720, dy: 40,
      duration: 5,
      scaleFrom: 0.78, scaleMid: 0.96, scaleTo: 0.78
    };
  }

  // Heroはあえてシーンを作らない（指示により飛ばさない・海鳥がいない時間を作る）
  // skills-toolsシーンは、境目の余白帯がスクロールでちょうど画面に入り始めたタイミングで
  // 飛ばしたいため、他のシーンより早いthreshold（#toolsに少しでも入った時点）で発火させる
  var scenes = [
    { key: 'about', trigger: '#about', build: aboutConfig, mobileEl: '#about .section-heading__jp' },
    { key: 'skills-tools', trigger: '#tools', threshold: 0, build: skillsToolsGapConfig, mobileEl: '#tools .section-heading__jp', reversed: true },
    { key: 'flow', trigger: '#flow', build: flowConfig, mobileEl: '#flow .section-heading__jp' }
  ];

  // PC/タブレット：1セクション内で完結する短い滑空（登場→滑空→少しカーブ→退場）
  function flyScene(cfg) {
    if (!cfg) return;
    if (flightTimeline && flightTimeline.isActive()) return;

    var reversed = !!cfg.reversed;

    setBasePosition(cfg.start.x, cfg.start.y);
    gsap.set(seagull, { scale: cfg.scaleFrom, opacity: 1, willChange: 'transform' });
    seagull.classList.add('is-active');
    setGlide(reversed);

    var path = buildCurvePath(cfg.dx, cfg.dy);
    var ease = 'sine.inOut';

    flightTimeline = gsap.timeline({ onComplete: hideSeagull });
    flightTimeline.call(function () { flapBurst(4, reversed); }, null, 0);

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
        .call(function () { flapBurst(2, reversed); })
        .to(seagull, { motionPath: { path: path, start: segA, end: segB, curviness: 1.2 }, duration: d2, ease: 'none' }, '>')
        .to(seagull, { motionPath: { path: path, start: segB, end: 1, curviness: 1.2 }, duration: d3, ease: 'sine.in' }, '>');
    } else {
      flightTimeline
        .to(seagull, { motionPath: { path: path, curviness: 1.2 }, duration: cfg.duration, ease: ease }, 0)
        .call(function () { flapBurst(2, reversed); }, null, cfg.duration * 0.5);
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
    setGlide(!!scene.reversed);
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
        { threshold: scene.threshold != null ? scene.threshold : 0.35 }
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

  // ---------- エンディング・フライト（STEP4：ページ最下部で一度だけ、静かに遠くへ去っていく） ----------
  // 他の3シーンとは目的が異なるため、意図的に独立したロジックにしている：
  //   ・横方向の周回ではなく「やや上方向へ抜けながら縮小・フェード」
  //   ・何度でも再生される通常シーンと違い、1セッション1回だけ（IntersectionObserverを発火後に破棄）
  //   ・発火してもすぐには飛ばさず、少し“間”を置いてから飛ばす
  function finishEnding() {
    seagull.classList.remove('is-active');
    gsap.set(seagull, { opacity: 0, willChange: 'auto' });
  }

  // PC/タブレット：Footer上部あたりから右上へ、ゆるい弧を描きながら小さく・薄くなって消える
  function flyEndingDesktop(footerRect) {
    var start = { x: footerRect.left + footerRect.width * 0.3, y: footerRect.top - 10 };
    var dx = 620, dy = -190; // 右方向へ大きく、上方向へゆるやかに（下に落ちて見えないよう必ず負のdy）
    var duration = 4;

    setBasePosition(start.x, start.y);
    gsap.set(seagull, { rotation: 0, scale: 0.85, opacity: 1, willChange: 'transform' });
    seagull.classList.add('is-active');
    setGlide(false);

    var path = buildCurvePath(dx, dy);

    flightTimeline = gsap.timeline({ onComplete: finishEnding });
    // 飛び始めに3回だけ軽く羽ばたき、あとは滑空（パタパタさせすぎない）
    flightTimeline.call(function () { flapBurst(3, false); }, null, 0);
    flightTimeline.to(seagull, { motionPath: { path: path, curviness: 1.2 }, duration: duration, ease: 'sine.inOut' }, 0);
    // 開始を100とすると終了は約56（40〜70の目安内）まで、終始なだらかに縮小し続ける
    flightTimeline.to(seagull, { scale: 0.48, duration: duration, ease: 'sine.inOut' }, 0);
    // 序盤は1のまま保持し、中盤で0.85程度、終盤にかけて0まで自然にフェード
    flightTimeline.to(seagull, { opacity: 0.85, duration: duration * 0.3, ease: 'sine.inOut' }, duration * 0.35);
    flightTimeline.to(seagull, { opacity: 0, duration: duration * 0.35, ease: 'sine.in' }, duration * 0.65);
  }

  // スマホ：完全に省略はせず、Footer上部でやや短く・控えめな上昇＋フェードに簡略化する
  function flyEndingMobile(footerRect) {
    var start = { x: footerRect.left + footerRect.width * 0.55, y: footerRect.top - 10 };
    var duration = 2.2;

    setBasePosition(start.x, start.y);
    gsap.set(seagull, { rotation: 0, scale: 0.55, opacity: 1, willChange: 'transform' });
    seagull.classList.add('is-active');
    setGlide(false);

    flightTimeline = gsap.timeline({ onComplete: finishEnding });
    flightTimeline.call(function () { flapBurst(2, false); }, null, 0);
    flightTimeline.to(seagull, { x: 150, y: -85, ease: 'sine.inOut', duration: duration }, 0);
    flightTimeline.to(seagull, { scale: 0.3, duration: duration, ease: 'sine.inOut' }, 0);
    flightTimeline.to(seagull, { opacity: 0, duration: duration * 0.5, ease: 'sine.in' }, duration * 0.5);
  }

  var ENDING_DELAY_MS = 1300; // Footerが見えてから、少し間を置いて飛び立たせる
  var endingPlayed = false;

  function initEndingScene() {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          attemptEnding(io);
        });
      },
      { threshold: 0.35 }
    );
    io.observe(footer);

    function attemptEnding(observer) {
      if (endingPlayed) return;
      // Flow等の通常シーンが飛行中なら衝突を避けてリトライし、終わり次第エンディングへ引き継ぐ
      if (flightTimeline && flightTimeline.isActive()) {
        setTimeout(function () { attemptEnding(observer); }, 400);
        return;
      }
      endingPlayed = true;
      observer.disconnect(); // 以降は二度と発火させない（1セッション1回）
      setTimeout(function () {
        var r = docRect(footer);
        if (desktopMql.matches) {
          flyEndingDesktop(r);
        } else {
          flyEndingMobile(r);
        }
      }, ENDING_DELAY_MS);
    }
  }

  // js/water-fx.jsのwindow.WaterFXと同様の公開パターン。
  // js/intro.jsがイントロゲートを閉じたタイミングでinit()を呼び、
  // Hero/About/Flowの通常シーン監視とFooterのエンディング監視を開始する
  window.SeagullFlight = {
    init: function () {
      initScenes();
      initEndingScene();
    }
  };
})();
