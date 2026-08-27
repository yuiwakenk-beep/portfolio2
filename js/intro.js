// ===================================================
// Yui Portfolio - intro.js
// 読み込み時イントロ：波に流されて瓶に入った手紙が画面中央（渚）に流れ着き、開封すると本編が現れる
//
// 状態：waiting → drifting → landing → arrived → opening → opened
//   waiting  : ゲート起動直後。海・波・砂浜だけが見え、瓶はまだ見えない（0.25〜0.4秒の間）
//   drifting : 瓶が画面左上から現れ、なめらかな弧を描きながら中央へ近づく
//   landing  : 弧の終盤、渚に近づき泡と共に打ち上げられる
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
  // <head>内の同期スクリプトが先取りで付けた intro-pending を外し、本編を通常表示に戻す
  // （このファイル内のどの早期returnパスでも、ゲートを起動しない場合は必ず呼ぶ）
  function releasePendingFallback() {
    document.documentElement.classList.remove('intro-pending');
  }

  // イントロが完全に終わった（＝本編がユーザーに見えている状態になった）タイミングで発火するイベント。
  // js/hero.js・js/hero-splash.jsはこれを合図にファーストビューの演出を開始する
  // （イントロ表示中に裏で演出が進んでしまい、本編が見えた瞬間にはもう演出が終わりかけている問題への対応）。
  // ゲートを起動しないパス（PEフォールバック等）でも、本編は最初から見えている＝即座に発火してよい。
  // 訪問済み（sessionStorage）の場合はページ読み込み直後・同期的に発火するため、<script>の読み込み順によっては
  // 後から読み込まれるスクリプト側がaddEventListenerする前にイベントを聞き逃す可能性がある。
  // そのため発火した事実をwindow.__introReadyにも残し、聞く側は「すでに発火済みか」を先に確認できるようにする
  function dispatchIntroReady() {
    window.__introReady = true;
    document.dispatchEvent(new CustomEvent('intro:ready'));
  }

  if (!gate || !bottle || !skip || !main) {
    releasePendingFallback();
    dispatchIntroReady();
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var alreadySeen;
  try {
    alreadySeen = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch (e) {
    alreadySeen = false; // sessionStorageが使えない環境（プライベートモード等）では毎回表示側に倒す
  }

  if (reduceMotion || alreadySeen || !window.gsap) {
    releasePendingFallback();
    dispatchIntroReady();
    if (window.SeagullFlight) window.SeagullFlight.init();
    return;
  }

  var closedFrame = bottle.querySelector('.intro-bottle__frame--closed');
  var openFrame = bottle.querySelector('.intro-bottle__frame--open');
  var shadowEl = bottle.querySelector('.intro-bottle__shadow');
  var foamEl = bottle.querySelector('.intro-bottle__foam');
  var shineEl = bottle.querySelector('.intro-bottle__shine');

  // ---------- 開封プロローグ（巻き紙→光→Hero）関連要素 ----------
  // 巻き紙は瓶の外の独立レイヤー（.intro-gate直下）。瓶素材（bottle-open.png）の絵の中にも
  // 巻き紙が描かれているため、瓶と同じ小さいスケールで重ねると見分けがつかなくなる問題があった
  var letterPaperEl = document.getElementById('introLetterPaper');
  var lightWashEl = document.getElementById('introLightWash');

  var state = 'waiting';

  function setState(next) {
    state = next;
    gate.dataset.state = next;
    bottle.dataset.state = next;
  }

  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* 何もしない */ }
  }

  // ---------- 瓶が画面左上から弧を描いて中央（渚）へ流れ着く演出 ----------
  // #introBottleは.intro-gate内でflex配置された画面中央が自然な位置（x:0,y:0相当）で、
  // これを最終着地点とする。開始位置はそこからの相対オフセットとして画面左上寄りに設定する。
  // 直線移動に見えないよう、x/y/回転+拡大をそれぞれ別のeaseを持つtweenとして同時に走らせ、
  // MotionPathPlugin等を使わずコアGSAPだけでなだらかな曲線軌道を作る（カクつき防止のため
  // tweenは開始→終了の1本のみとし、動きの途中で速度がゼロに戻る中間ポイントを作らない）。
  var washTimeline = null;

  function washBottleAshore(onArrived) {
    var isMobile = !window.matchMedia('(min-width: 768px)').matches;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 中央からの相対オフセットで、画面左上寄りに開始位置を置く（安全マージン込み）
    var startX = -(vw * (isMobile ? 0.3 : 0.36));
    var startY = -(vh * (isMobile ? 0.26 : 0.32));
    var startScale = isMobile ? 0.6 : 0.55;
    var startRotation = -8;

    var pauseDuration = isMobile ? 0.25 : 0.4;
    var arcDuration = isMobile ? 1.6 : 2.4;
    var settleDuration = isMobile ? 0.35 : 0.45;

    // 波に揺られている感じを出すための微振動（回転・上下）。
    // 弧の移動そのもの（x/y/scaleの基本イージング）とは別レイヤーで、
    // サインカーブで正弦的に加算する（線形補間だとカクついて見えるため）。
    // envelopeで弧の開始・終了ではゼロに収束させ、着地後の姿勢とタグの位置関係がズレないようにする
    var wobbleRotAmp = 6; // deg
    var wobbleYAmp = 4; // px
    var wobblePeriod = 0.85; // 秒
    var wobbleFreq = (Math.PI * 2) / wobblePeriod;

    gsap.set(bottle, { x: startX, y: startY, scale: startScale, rotation: startRotation, opacity: 0 });
    if (foamEl) gsap.set(foamEl, { opacity: 0, scale: 0.6 });
    if (shineEl) gsap.set(shineEl, { opacity: 0, backgroundPosition: '-150% -150%' });
    if (shadowEl) gsap.set(shadowEl, { opacity: 0.12 });
    gsap.set(bottle, { willChange: 'transform, opacity' });

    washTimeline = gsap.timeline({
      onComplete: function () {
        gsap.set(bottle, { clearProps: 'transform,opacity,willChange' });
        if (onArrived) onArrived();
      }
    });

    // まず一瞬、海・波・砂浜だけを見せ、いきなり瓶を出さない
    washTimeline.call(function () { setState('drifting'); }, null, pauseDuration);
    washTimeline.to(bottle, { opacity: 1, duration: 0.5, ease: 'sine.out' }, pauseDuration);

    // x/yを異なるイージングで同時に0へ寄せることで、直線ではない緩やかな弧を描かせる
    washTimeline.to(bottle, { x: 0, ease: 'power1.inOut', duration: arcDuration }, pauseDuration);
    washTimeline.to(bottle, { scale: 1, ease: 'sine.inOut', duration: arcDuration }, pauseDuration);

    // yとrotationは「弧の基本軌道」をproxyオブジェクトで裏計算しつつ、
    // 毎フレームsin波の揺れを重ねてbottle本体へ適用する
    var wobbleProxy = { y: startY, rot: startRotation };
    var wobbleStart = null;
    function applyWobble() {
      if (wobbleStart === null) wobbleStart = performance.now();
      var elapsed = (performance.now() - wobbleStart) / 1000;
      var envelope = Math.sin(Math.PI * Math.min(1, elapsed / arcDuration));
      var wobbleRot = Math.sin(elapsed * wobbleFreq) * wobbleRotAmp * envelope;
      var wobbleY = Math.sin(elapsed * wobbleFreq * 1.3 + Math.PI / 2) * wobbleYAmp * envelope;
      gsap.set(bottle, { y: wobbleProxy.y + wobbleY, rotation: wobbleProxy.rot + wobbleRot });
    }
    washTimeline.to(wobbleProxy, { y: 0, ease: 'power3.out', duration: arcDuration, onUpdate: applyWobble }, pauseDuration);
    washTimeline.to(wobbleProxy, { rot: 0, ease: 'sine.inOut', duration: arcDuration, onUpdate: applyWobble }, pauseDuration);

    var landT = pauseDuration + arcDuration;
    washTimeline.call(function () { setState('landing'); }, null, Math.max(pauseDuration, landT - 0.3));

    // 弧の終盤、瓶の足元を白い泡が一度だけ通り過ぎる
    if (foamEl) {
      washTimeline.to(foamEl, { opacity: 0.85, scale: 1, duration: settleDuration, ease: 'sine.out' }, landT - 0.15);
      washTimeline.to(foamEl, { opacity: 0, duration: 0.6, ease: 'sine.in' }, landT + 0.25);
    }
    // ガラスに海の光が一瞬反射する
    if (shineEl) {
      washTimeline.to(shineEl, { opacity: 0.55, backgroundPosition: '150% 150%', duration: 0.6, ease: 'sine.inOut' }, landT - 0.1);
      washTimeline.to(shineEl, { opacity: 0, duration: 0.3, ease: 'sine.out' }, landT + 0.35);
    }

    // 最後にふわっと着地して静止。bounceではなくback.outの小さな余韻のみ
    washTimeline.to(bottle, { scale: 1.04, duration: settleDuration * 0.5, ease: 'sine.out' }, landT - 0.05);
    washTimeline.to(bottle, { scale: 1, duration: settleDuration, ease: 'back.out(1.3)' }, landT + settleDuration * 0.5 - 0.05);
  }

  // ---------- ゲート起動 ----------
  // ここから先はJS（is-active・main.style.visibility）が表示制御の主導権を持つため、
  // <head>の同期スクリプトが付けたintro-pendingは外す。外し忘れると、後で
  // main.style.visibility=''に戻しても html.intro-pending #main{visibility:hidden}の
  // クラス指定がまだ残っていて、本編が永久に隠れたままになってしまう
  document.documentElement.classList.remove('intro-pending');
  main.setAttribute('inert', '');
  // inertは操作不可・AT非公開にはなるが、視覚的には隠さない。.intro-gate側の被覆漏れに対する
  // 保険として、本編側でも明示的にvisibility:hiddenにしておく（クリックも通さなくなり安全性も上がる）
  main.style.visibility = 'hidden';
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
    if (foamEl) gsap.set(foamEl, { opacity: 0 });
    if (shineEl) gsap.set(shineEl, { opacity: 0 });
    closedFrame.classList.add('is-visible');
    setState('arrived');
    bottle.disabled = false;

    // ここでのfocus()はキーボード操作を伴わないため、Chromeの:focus-visible判定が
    // 「常時表示すべき」と誤判定し、四角いフォーカスリングがずっと出っぱなしになる。
    // is-auto-focusedが付いている間だけ:focus-visibleの見た目を抑え、
    // ユーザーが実際にTab操作等でフォーカスし直した際（blur→再focus）は通常どおりリングを出す
    bottle.classList.add('is-auto-focused');
    bottle.focus();
    bottle.addEventListener(
      'blur',
      function onAutoFocusBlur() {
        bottle.classList.remove('is-auto-focused');
      },
      { once: true }
    );

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

  // 漂流演出（PC約3.5秒、モバイル約2.5秒）より十分長め。万一演出が失敗しても瓶は必ず打ち上げる
  var fallbackTimer = setTimeout(function () {
    if (state !== 'arrived' && state !== 'opening' && state !== 'opened') arrive();
  }, 5200);

  washBottleAshore(arrive);

  // ---------- 開封プロローグ：巻き紙→手紙の文面→光→Hero ----------
  // 連鎖するsetTimeoutのIDをすべてここに積み、skip時に一括clearTimeoutできるようにする
  var introTimers = [];
  function scheduleIntro(fn, delay) {
    var id = setTimeout(fn, delay);
    introTimers.push(id);
    return id;
  }
  function clearIntroTimers() {
    introTimers.forEach(function (id) { clearTimeout(id); });
    introTimers = [];
  }

  // 各ステップのタイミング（ms）。すべてクリックからの絶対経過時間で固定している
  // （setTimeoutのみで完結する構成のため、rAFの遅延に影響されず必ず時間どおりに進む）。
  // 「丸まる→半分開く」の段階演出を廃止したため、以前より短いテンポになっている
  var INTRO_LETTER_TIMING = {
    writtenAt: 700, // 紙が現れてから、上に「Welcome to my portfolio」を書く
    dissolveAt: 3200, // 紙を消しつつ光を広げ始める
    heroAt: 4200, // 光が覆いきり、Heroへ切り替える
    lightWashOutDuration: 900 // 光が引いてHeroが現れる
  };

  function resetLetterSequenceVisuals() {
    bottle.classList.remove('is-hidden');
    letterPaperEl.classList.remove('is-visible', 'is-written', 'is-dissolving');
    lightWashEl.classList.remove('is-active');
  }

  // ---------- 開封・スキップ共通の最終後処理 ----------
  function completeIntro() {
    setState('opened');
    markSeen();
    document.body.style.overflow = '';
    if (window.SeagullFlight) window.SeagullFlight.init();
    dispatchIntroReady();
  }

  // 光が画面を覆いきったタイミングで、隠れたまま裏でHero（#main）を見せる準備を整える。
  // .intro-gateの通常のopacity transition（0.6s）に任せると、光の演出（.intro-light-wash）が
  // フェードアウトし始める瞬間とゲート自体のフェードアウトが重なり、
  // 海色（青）のゲートが薄く透けて本編に色がかぶって見えてしまっていた。
  // ここではtransitionを一時的に無効化し、ゲートを一瞬で消してから光の演出に引き継ぐ
  function revealMainBehindWash() {
    gate.style.transition = 'none';
    gate.classList.remove('is-active');
    gate.style.opacity = '0';
    gate.style.visibility = 'hidden';
    gate.setAttribute('aria-hidden', 'true');
    main.removeAttribute('inert');
    main.style.visibility = '';
    document.body.style.overflow = '';
  }

  function startLetterSequence() {
    var T = INTRO_LETTER_TIMING;

    // ④ 瓶がわずかに反応：コルクが緩む動き＋ガラスが淡く光る（既存の反射光エフェクトを流用）してから、
    // 巻き紙（別レイヤー）にバトンタッチして完全に非表示にする。以降is-hiddenは二度と外さない
    gsap.to(bottle, { y: -4, scale: 1.02, duration: 0.4, ease: 'sine.out' });
    openFrame.classList.add('is-visible');
    if (shineEl) {
      gsap.set(shineEl, { opacity: 0, backgroundPosition: '-150% -150%' });
      gsap.to(shineEl, { opacity: 0.5, backgroundPosition: '150% 150%', duration: 0.9, ease: 'sine.inOut' });
      gsap.to(shineEl, { opacity: 0, duration: 0.4, ease: 'sine.out' }, '+=0.3');
    }
    bottle.classList.add('is-hidden');
    // 巻き紙：開いた状態の1枚をフェード＋拡大でふわっと表示する
    letterPaperEl.classList.add('is-visible');

    // ⑤ 紙の上に「Welcome to my portfolio」をclip-pathで書く
    scheduleIntro(function () { letterPaperEl.classList.add('is-written'); }, T.writtenAt);

    // ⑥ 紙を消しつつ光を広げる
    scheduleIntro(function () {
      letterPaperEl.classList.add('is-dissolving');
      lightWashEl.classList.add('is-active');
    }, T.dissolveAt);

    // ⑦ 光が覆いきったところで、隠れたままHeroへ切り替える
    scheduleIntro(function () {
      revealMainBehindWash();
      // Heroが見えている状態のまま、光を引かせる
      scheduleIntro(function () { lightWashEl.classList.remove('is-active'); }, 60);
      // 光が引き終えたら完全に完了
      scheduleIntro(completeIntro, 60 + T.lightWashOutDuration);
    }, T.heroAt);
  }

  // ---------- 開封（クリック。<button>のためEnter/Spaceも自動的にclickを発火する） ----------
  function openIntro() {
    if (state !== 'arrived') return;
    setState('opening');
    bottle.disabled = true;
    startLetterSequence();
  }

  bottle.addEventListener('click', openIntro);

  // ---------- スキップ：漂流中・開封プロローグ中を問わず、いつでも即座に本編へ ----------
  function skipIntro(e) {
    if (e) e.preventDefault();
    if (state === 'opened') return;
    if (washTimeline) washTimeline.kill();
    clearTimeout(fallbackTimer);
    clearIntroTimers();
    setState('opening');
    bottle.disabled = true;
    resetLetterSequenceVisuals();
    // 「即座に本編へ」なので、ゲート自体の通常フェード（0.6s）を待たず即時に消す。
    // フェードを待つ間ここでmain.removeAttribute('inert')してしまうと、
    // 薄くなっていくゲート（海色）越しに本編が透けて見えてしまう
    gate.style.transition = 'none';
    gate.classList.remove('is-active');
    gate.style.opacity = '0';
    gate.style.visibility = 'hidden';
    gate.setAttribute('aria-hidden', 'true');
    main.removeAttribute('inert');
    main.style.visibility = '';
    completeIntro();
  }

  skip.addEventListener('click', skipIntro);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state !== 'opened') skipIntro();
  });
})();
