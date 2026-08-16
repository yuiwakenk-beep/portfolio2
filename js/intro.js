// ===================================================
// Yui Portfolio - intro.js
// 読み込み時イントロ：波に流されて瓶に入った手紙が砂浜に流れ着き、開封すると本編が現れる
//
// 状態：waiting → drifting → landing → arrived → opening → opened
//   waiting  : ゲート起動直後。海・波・砂浜だけが見え、瓶はまだ見えない（0.4〜0.8秒の間）
//   drifting : 瓶が沖から現れ、波に押される→少し戻る→押される…を繰り返しながら近づく
//   landing  : 最後の波に乗って渚へ近づき、泡と共に打ち上げられる
//   arrived  : 完全に静止。ここで初めてクリック可能になり、少し遅れてCTAが現れる
//   opening  : 開封演出中（クリック不可）
//   opened   : 開封済み。以後は何もしない
//
// 表示条件（いずれかに該当する場合はゲートを一切起動せず、本編をデフォルトのまま表示する）：
//   - 同一セッション中に既に見ている（sessionStorage）
//   - prefers-reduced-motion
//   - GSAPが読み込めていない
// .intro-gateはCSSでopacity:0; pointer-events:noneがデフォルトで、
// #introBottleもHTML側でdisabled既定のため、上記いずれかで早期returnしても
// 本編はそのまま通常表示になる（PEフォールバック）。
// 瓶のアニメーションはtransform/opacityのみのシンプルなGSAPタイムラインで組んでおり、
// ScrollTrigger/MotionPathPluginへの依存はない（GSAPコアのみで完結）。
// ===================================================
(function () {
  'use strict';

  var SESSION_KEY = 'introSeen';

  var gate = document.getElementById('introGate');
  var bottle = document.getElementById('introBottle');
  var skip = document.getElementById('introSkip');
  var main = document.getElementById('main');
  var wavePulse = document.getElementById('introWavePulse');
  if (!gate || !bottle || !skip || !main) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var alreadySeen;
  try {
    alreadySeen = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch (e) {
    alreadySeen = false; // sessionStorageが使えない環境（プライベートモード等）では毎回表示側に倒す
  }

  if (reduceMotion || alreadySeen || !window.gsap) {
    if (window.SeagullFlight) window.SeagullFlight.init();
    return;
  }

  var closedFrame = bottle.querySelector('.intro-bottle__frame--closed');
  var openFrame = bottle.querySelector('.intro-bottle__frame--open');
  var shadowEl = bottle.querySelector('.intro-bottle__shadow');
  var foamEl = bottle.querySelector('.intro-bottle__foam');
  var shineEl = bottle.querySelector('.intro-bottle__shine');
  var state = 'waiting';

  function setState(next) {
    state = next;
    gate.dataset.state = next;
    bottle.dataset.state = next;
  }

  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* 何もしない */ }
  }

  // ---------- 瓶が波に流されて渚へ打ち上げられる演出 ----------
  // 「押す→少し戻る→押す→漂う→最後の一押し」の複数拍で、一定速度の直線移動にしない。
  // 各拍はdx/dyの相対量として定義し、開始位置からの累積座標（絶対値）へ変換してからtweenする
  // （relative "+="はtween生成時の値で解決されるため、生成前に累積してabsoluteで渡す）。
  // #introBottleは.intro-gate内でflex配置された自然な位置（x:0,y:0相当）を最終着地点とする。
  var washTimeline = null;

  function washBottleAshore(onArrived) {
    var isMobile = !window.matchMedia('(min-width: 768px)').matches;

    // 遠い沖（右奥）からやや斜めに近づいてくる。scaleも同時に大きくして奥行きを作る
    var startPos = isMobile
      ? { x: 92, y: -38, scale: 0.74, rotation: -3 }
      : { x: 158, y: -66, scale: 0.66, rotation: -4 };

    // モバイルは押し引きを3拍（波1回分少ない）・移動量も小さくして画面外に出ないようにする
    var beats = isMobile
      ? [
          { dx: -52, dy: 30, scale: 0.84, rot: 3, dur: 0.55, ease: 'sine.out', surge: true },
          { dx: -34, dy: 18, scale: 0.82, rot: -2, dur: 0.4, ease: 'sine.inOut', surge: false },
          { dx: -95, dy: 84, scale: 0.98, rot: 1, dur: 0.6, ease: 'sine.out', surge: true, isFinal: true }
        ]
      : [
          { dx: -72, dy: 42, scale: 0.8, rot: 3, dur: 0.75, ease: 'sine.out', surge: true }, // 波1：押される
          { dx: -50, dy: 30, scale: 0.76, rot: -2, dur: 0.55, ease: 'sine.inOut', surge: false }, // 波1：少し戻る
          { dx: -118, dy: 80, scale: 0.9, rot: 1, dur: 0.8, ease: 'sine.out', surge: true }, // 波2：再び押される
          { dx: -55, dy: 24, scale: 0.94, rot: -1.5, dur: 0.5, ease: 'sine.inOut', surge: false }, // 波2：漂う
          { dx: -45, dy: 22, scale: 0.98, rot: 0.5, dur: 0.7, ease: 'sine.out', surge: true, isFinal: true } // 波3：渚へ
        ];

    gsap.set(bottle, { x: startPos.x, y: startPos.y, scale: startPos.scale, rotation: startPos.rotation, opacity: 0 });
    if (wavePulse) gsap.set(wavePulse, { scaleY: 0.3, opacity: 0 });
    if (foamEl) gsap.set(foamEl, { opacity: 0, scale: 0.6 });
    if (shineEl) gsap.set(shineEl, { opacity: 0, backgroundPosition: '-150% -150%' });
    if (shadowEl) gsap.set(shadowEl, { opacity: 0.12 });
    gsap.set(bottle, { willChange: 'transform, opacity' });

    washTimeline = gsap.timeline({
      onComplete: function () {
        gsap.set(bottle, { clearProps: 'transform,opacity,willChange' });
        if (wavePulse) gsap.set(wavePulse, { scaleY: 0.3, opacity: 0 });
        if (onArrived) onArrived();
      }
    });

    var pauseDuration = isMobile ? 0.4 : 0.8;
    var t = pauseDuration;

    // まず0.4〜0.8秒は海・波・砂浜だけを見せ、いきなり瓶を出さない
    washTimeline.call(function () { setState('drifting'); }, null, t);
    washTimeline.to(bottle, { opacity: 0.55, duration: 0.3, ease: 'sine.out' }, t);

    var curX = startPos.x;
    var curY = startPos.y;

    beats.forEach(function (beat, i) {
      curX += beat.dx;
      curY += beat.dy;

      washTimeline.to(
        bottle,
        {
          x: curX,
          y: curY,
          scale: beat.scale,
          rotation: beat.rot,
          opacity: Math.min(1, 0.55 + i * 0.13),
          duration: beat.dur,
          ease: beat.ease
        },
        t
      );

      // 波が近づく→瓶が押される、のタイミングを視覚的に同期させる
      if (beat.surge && wavePulse) {
        washTimeline.to(wavePulse, { scaleY: 1, opacity: 0.7, duration: beat.dur * 0.5, ease: 'sine.out' }, t);
        washTimeline.to(wavePulse, { scaleY: 0.3, opacity: 0.15, duration: beat.dur * 0.7, ease: 'sine.inOut' }, t + beat.dur * 0.5);
      }

      if (beat.isFinal) {
        washTimeline.call(function () { setState('landing'); }, null, t);

        // 漂着直前、瓶の足元を白い泡が一度だけ通り過ぎる
        if (foamEl) {
          washTimeline.to(foamEl, { opacity: 0.85, scale: 1, duration: beat.dur * 0.55, ease: 'sine.out' }, t + beat.dur * 0.25);
          washTimeline.to(foamEl, { opacity: 0, duration: 0.6, ease: 'sine.in' }, t + beat.dur * 0.8);
        }
        // ガラスに海の光が一瞬反射する
        if (shineEl) {
          washTimeline.to(shineEl, { opacity: 0.55, backgroundPosition: '150% 150%', duration: 0.6, ease: 'sine.inOut' }, t);
          washTimeline.to(shineEl, { opacity: 0, duration: 0.3, ease: 'sine.out' }, t + 0.45);
        }
      }

      t += beat.dur;
    });

    // 最後にひと押しで渚へ乗り上げ、「ふわっ→ゆら→静止」。bounceではなくback.outの小さな余韻のみ
    washTimeline.to(bottle, { y: curY - 14, duration: 0.28, ease: 'sine.out' }, t - 0.12);
    washTimeline.to(
      bottle,
      { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.65, ease: 'back.out(1.35)' },
      t
    );
  }

  // ---------- ゲート起動 ----------
  main.setAttribute('inert', '');
  gate.classList.add('is-active');
  gate.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  function arrive() {
    if (state === 'arrived' || state === 'opening' || state === 'opened') return;
    clearTimeout(fallbackTimer);
    // 通常はwashTimelineが自走してこの時点で既に着地姿勢になっているが、
    // フォールバックタイマー経由で呼ばれた場合はタイムラインが漂流演出の途中で止まっている
    // 可能性がある。念のため着地後の姿勢へ強制的に揃えてから操作可能にする
    if (washTimeline) washTimeline.kill();
    gsap.set(bottle, { clearProps: 'transform,opacity,willChange' });
    if (wavePulse) gsap.set(wavePulse, { scaleY: 0.3, opacity: 0 });
    if (foamEl) gsap.set(foamEl, { opacity: 0 });
    if (shineEl) gsap.set(shineEl, { opacity: 0 });
    closedFrame.classList.add('is-visible');
    setState('arrived');
    bottle.disabled = false;
    bottle.focus();

    // ごく控えめな水滴を1粒だけ（渚に触れた質感の演出。既存WaterFXを流用）
    if (window.WaterFX) {
      var r = bottle.getBoundingClientRect();
      window.WaterFX.spawnDroplet(bottle, {
        x: r.width * 0.5,
        y: r.height * 0.82,
        angle: -Math.PI / 2 + 0.3,
        distance: 9,
        duration: 0.55
      });
    }
  }

  // 漂流演出（PC約5秒、モバイル約3秒）より十分長め。万一演出が失敗しても瓶は必ず打ち上げる
  var fallbackTimer = setTimeout(function () {
    if (state !== 'arrived' && state !== 'opening' && state !== 'opened') arrive();
  }, 6500);

  washBottleAshore(arrive);

  // ---------- 開封・スキップ共通の後処理 ----------
  function finishClose() {
    setState('opened');
    markSeen();
    document.body.style.overflow = '';
    main.removeAttribute('inert');
    gate.setAttribute('aria-hidden', 'true');
    if (window.SeagullFlight) window.SeagullFlight.init();
  }

  // ---------- 開封（クリック。<button>のためEnter/Spaceも自動的にclickを発火する） ----------
  function openIntro() {
    if (state !== 'arrived') return;
    setState('opening');
    bottle.disabled = true;

    var tl = gsap.timeline({ onComplete: finishClose });
    tl.to(bottle, { y: -6, scale: 1.04, duration: 0.35, ease: 'sine.out' }, 0);
    tl.call(function () { openFrame.classList.add('is-visible'); }, null, 0.15);
    tl.to(bottle, { opacity: 0, y: -14, duration: 0.5, ease: 'sine.out' }, '+=0.25');
    // ここでCSS側の .intro-gate opacity transition（0.6s）を開始させる
    tl.call(function () { gate.classList.remove('is-active'); }, null, '-=0.1');
  }

  bottle.addEventListener('click', openIntro);

  // ---------- スキップ：漂流中でもいつでも即座に本編へ ----------
  function skipIntro(e) {
    if (e) e.preventDefault();
    if (state === 'opening' || state === 'opened') return;
    if (washTimeline) washTimeline.kill();
    clearTimeout(fallbackTimer);
    setState('opening');
    bottle.disabled = true;
    gate.classList.remove('is-active'); // 開封アニメーションなしで即座にCSSフェード開始
    finishClose();
  }

  skip.addEventListener('click', skipIntro);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state !== 'opening' && state !== 'opened') skipIntro();
  });
})();
