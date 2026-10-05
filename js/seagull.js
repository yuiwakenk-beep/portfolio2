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
  // maxWig：S字の振れ幅の上限(px)。省略時は60。狭い余白帯を飛ぶシーンでは小さくする
  function buildCurvePath(dx, dy, maxWig) {
    var nx = -dy;
    var ny = dx;
    var len = Math.sqrt(nx * nx + ny * ny) || 1;
    var wig = Math.min(maxWig || 60, len * 0.14);
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

  // 飛行後のフェードアウト。次の飛行（特にFooterのエンディング）がこのフェードの途中で始まると、
  // 新しい海鳥まで透明にされ、is-activeも外されて見えなくなるため、
  // tweenを保持しておき、新しく飛ばす前にstopHide()で必ず止める
  var hideTween = null;

  function stopHide() {
    if (hideTween) {
      hideTween.kill();
      hideTween = null;
    }
  }

  function hideSeagull() {
    stopHide();
    hideTween = gsap.to(seagull, {
      opacity: 0,
      duration: 1.2,
      delay: 0.4,
      onComplete: function () {
        hideTween = null;
        seagull.classList.remove('is-active');
        gsap.set(seagull, { willChange: 'auto' });
      }
    });
  }

  // ---------- シーン定義（各セクション内で完結する短い飛行） ----------
  // 各シーンは「飛ぶ高さ（ドキュメント座標のy）」と進行方向だけを決める。
  // 横方向は画面幅に合わせて「画面の端から端まで横切る」ようflyScene()側で計算するため、
  // PC・スマホとも同じシーン定義を使う（スマホもPCと同じ位置・同じ飛び方）。
  // dy: 縦移動量（真下移動は作らない。控えめな値にする）
  function aboutConfig() {
    // 【スマホのみ】FV（#hero）の下端から「About Me / 自己紹介」見出しの上端までの空間（縦約120px）の
    // 縦中央を飛ばす。PCと同じ位置だとスマホではプロフィール写真にかかるため。
    // 空間が狭いので縦移動なし・S字の振れ幅も小さくし、見出しやFVに入り込まないようにしている。
    // .seagullは高さ0の箱で、海鳥の画像（正方形）は箱の上端から下へ描かれ、拡大縮小も上端基準になるため、
    // 表示サイズの半分だけ上にずらして、海鳥の中心を空間の縦中央に合わせる
    if (!desktopMql.matches) {
      var hero = document.querySelector('#hero');
      var heading = document.querySelector('#about .section-heading');
      if (hero && heading) {
        var mid = (docRect(hero).bottom + docRect(heading).top) / 2;
        return {
          y: mid - (SEAGULL_W * MOBILE_SIZE_RATIO * 0.9) / 2,
          dy: 0,
          maxWig: 20,
          scaleFrom: 0.85, scaleMid: 0.95, scaleTo: 0.85
        };
      }
    }
    var row = document.querySelector('.concept-about-row') || document.querySelector('#about');
    if (!row) return null;
    var r = docRect(row);
    return {
      y: r.top + r.height * 0.1,
      dy: 70,
      scaleFrom: 0.78, scaleMid: 0.98, scaleTo: 0.8
    };
  }

  // 「対応できること」のカード群末尾と「使用ツール」の見出しの間にできる余白帯
  // （それぞれのsection-innerのpadding-bottom/padding-top分の空き）だけを飛行帯にする。
  // カード・チップ・見出し文字のどれにも被らない。
  // このシーンだけ右から出現して左へ飛ばしたいため、reversedにして左向きフレームを使う
  function skillsToolsGapConfig() {
    var skillsGrid = document.querySelector('#skills .skills__grid');
    var toolsHeading = document.querySelector('#tools .section-heading');
    if (!skillsGrid || !toolsHeading) return null;
    var gRect = docRect(skillsGrid);
    var hRect = docRect(toolsHeading);
    return {
      y: (gRect.bottom + hRect.top) / 2,
      dy: 24,
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
      y: r.bottom + 30,
      dy: 40,
      scaleFrom: 0.78, scaleMid: 0.96, scaleTo: 0.78
    };
  }

  // Heroはあえてシーンを作らない（指示により飛ばさない・海鳥がいない時間を作る）
  // 一度飛行帯が画面中央から離れて戻ってくれば、何度でも再発火する
  var scenes = [
    { key: 'about', build: aboutConfig },
    { key: 'skills-tools', build: skillsToolsGapConfig },
    { key: 'flow', build: flowConfig }
  ];

  // ---------- 飛行時間・大きさ（PC/スマホ） ----------
  // 以前はPCが780px固定の移動量・5秒で、広い画面では途中で消えて見える範囲が短かったため、
  // 画面の端から端まで横切る移動量にし、時間も延ばした。
  // スマホは画面幅が狭いぶん移動距離が短いので、PCより短い時間でも同じくらいゆっくり見える
  var DESKTOP_DURATION = 8; // 秒
  var MOBILE_DURATION = 6; // 秒
  var MOBILE_SIZE_RATIO = 0.66; // スマホは海鳥を小さくする（.seagullの幅150px × 0.66 ≒ 100px）
  var SEAGULL_W = 150; // css/animation.cssの .seagull { width: 150px; } と一致させる
  var EDGE_GAP = 8; // 画面右端との最小のすき間(px)

  // 1セクション内で完結する滑空（登場→画面を横切る→少しカーブ→退場）。PC・スマホ共通
  // 左側は画面の外から現れ／外へ抜ける。
  // 右側は画面の外に出すと、スマホ（特にiPhone Safari）で横スクロールが発生する恐れがあるため、
  // 画面右端の内側で「ふわっと現れる」「ふわっと消える」ようにしている
  function flyScene(cfg) {
    if (!cfg) return;
    if (flightTimeline && flightTimeline.isActive()) return;
    stopHide();

    var reversed = !!cfg.reversed;
    var isDesktop = desktopMql.matches;
    var duration = isDesktop ? DESKTOP_DURATION : MOBILE_DURATION;
    var sizeRatio = isDesktop ? 1 : MOBILE_SIZE_RATIO;
    var vw = document.documentElement.clientWidth;
    var leftOutX = window.scrollX - SEAGULL_W - 10; // 画面の左外
    var rightInX = window.scrollX + vw - SEAGULL_W - EDGE_GAP; // 画面右端の内側
    var startX = reversed ? rightInX : leftOutX;
    var endX = reversed ? leftOutX : rightInX;

    setBasePosition(startX, cfg.y);
    gsap.set(seagull, {
      scale: cfg.scaleFrom * sizeRatio,
      opacity: reversed ? 0 : 1, // 右から登場するときは、画面右端の内側でふわっと現れる
      willChange: 'transform'
    });
    seagull.classList.add('is-active');
    setGlide(reversed);

    var path = buildCurvePath(endX - startX, cfg.dy, cfg.maxWig);

    flightTimeline = gsap.timeline({ onComplete: hideSeagull });
    flightTimeline.call(function () { flapBurst(4, reversed); }, null, 0);
    flightTimeline
      .to(seagull, { motionPath: { path: path, curviness: 1.2 }, duration: duration, ease: 'sine.inOut' }, 0)
      .call(function () { flapBurst(2, reversed); }, null, duration * 0.5);

    // 画面右端の内側で現れる／消えるぶんのフェード
    if (reversed) {
      flightTimeline.to(seagull, { opacity: 1, duration: duration * 0.15, ease: 'sine.out' }, 0);
    } else {
      flightTimeline.to(seagull, { opacity: 0, duration: duration * 0.18, ease: 'sine.in' }, duration * 0.82);
    }

    // 奥行き（scale）：前半sine.out（中間へ滑らかに減速して到達）→後半sine.in（中間から滑らかに加速して離れる）
    // にすることで、中間地点で速度が繋がり「止まって再加速」する継ぎ目をなくす
    flightTimeline.to(seagull, { scale: cfg.scaleMid * sizeRatio, duration: duration * 0.5, ease: 'sine.out' }, 0);
    flightTimeline.to(seagull, { scale: cfg.scaleTo * sizeRatio, duration: duration * 0.5, ease: 'sine.in' }, duration * 0.5);
  }

  // ---------- 飛び始めるタイミング ----------
  // 以前はセクションが画面下に少し入った時点（IntersectionObserver）で飛ばしていたため、
  // 海鳥が画面の下のほうを飛び、スクロールするとすぐ画面外に出てしまっていた。
  // 飛行帯（各シーンのy）が画面の縦30〜70%の範囲に入った瞬間に飛ばし、しばらく画面内で見えるようにする
  var BAND_TOP = 0.3;
  var BAND_BOTTOM = 0.7;
  var sceneInBand = {};
  var scenesStarted = false;
  var checkQueued = false;

  function checkScenes() {
    checkQueued = false;
    var vh = window.innerHeight;
    scenes.forEach(function (scene) {
      var cfg = scene.build();
      if (!cfg) return;
      var viewY = cfg.y - window.scrollY;
      var inBand = viewY > vh * BAND_TOP && viewY < vh * BAND_BOTTOM;
      if (inBand && !sceneInBand[scene.key]) flyScene(cfg);
      sceneInBand[scene.key] = inBand;
    });
  }

  function queueCheck() {
    if (checkQueued) return;
    checkQueued = true;
    requestAnimationFrame(checkScenes);
  }

  function initScenes() {
    if (scenesStarted) return; // js/intro.jsから二重に呼ばれてもリスナーを重複登録しない
    scenesStarted = true;
    window.addEventListener('scroll', queueCheck, { passive: true });
    window.addEventListener('resize', queueCheck);
    queueCheck();
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

    stopHide(); // 直前のシーンのフェードアウトがエンディングの海鳥を消さないよう止める
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

    stopHide(); // 直前のシーンのフェードアウトがエンディングの海鳥を消さないよう止める
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
