// ===================================================
// Yui Portfolio - hero.js
// ファーストビュー写真に合わせたPC画面のはめ込み（射影変換）と
// 万年筆の手書きアニメーション
// ===================================================
(function () {
  'use strict';

  var heroPhoto = document.getElementById('heroPhoto');
  if (!heroPhoto) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // new.png（背景写真）の基準キャンバスサイズ
  var REF_W = 1536, REF_H = 1024;
  // hero-mobile-base.png（スマホ専用・カーテン別レイヤー版の写真）の基準キャンバスサイズ。
  // 旧hero-mobile.png（853x1844、カーテン焼き込み済み）とは縦横比・構図が異なる別素材のため、
  // 基準サイズだけでなく、これを参照するheroRectsMobile／laptopCornersMobileも
  // 新素材に合わせて再計測している
  var REF_W_MOBILE = 941, REF_H_MOBILE = 1672;

  // 写真は object-fit:cover で表示されるため、実際の表示上のトリミング量を計算して
  // オーバーレイ（見出し・手書きテキスト・PC画面）の位置を写真に正確に合わせる（PC版のみ）
  var heroRects = {
    heroHeadlineSvg: { left: 47, top: 260, width: 636, height: 78 },
    heroPenSvg:       { left: 90, top: 308, width: 534, height: 92 }
  };

  // 手書き風コピー（#heroPenSvg）のSVG viewBox比率（PC/スマホ共通）
  var PEN_VIEWBOX_W = 685, PEN_VIEWBOX_H = 118;

  // スマホは写真の構図に対する固定座標ではなく、見出しブロック（.hero__intro-mobile）の
  // 実際のレンダリング位置を基準に手書きコピーを配置する（画面幅・見出しの折返し行数が変わっても
  // 常にタイトル直下に来るようにするため）。
  // PAD_Xはcss/responsive.cssの .hero__intro-mobile { padding: 0 24px; } と必ず一致させる
  var MOBILE_INTRO_PAD_X = 24;
  // タイトル下端から手書きコピーまでのすき間（目安12〜20pxの中間値）。
  // ?heropos=1 の位置調整ツールでも変更でき、その場合はここへ確定値を反映する
  var mobilePenGap = { value: 16 };

  function isDesktopBreakpoint() {
    return window.matchMedia('(min-width: 768px)').matches;
  }

  // 手書きコピーの現在有効な配置（実レンダリング座標のpx）。PC/スマホで算出方法が異なるため、
  // ここで一本化し、positionHeroOverlays()とペン先アニメーション側の両方から呼ぶ
  function currentPenBoxPx() {
    if (isDesktopBreakpoint()) {
      var s = currentScale();
      var r = heroRects.heroPenSvg;
      return { left: s.offX + r.left * s.scale, top: s.offY + r.top * s.scale, width: r.width * s.scale };
    }
    var heroEl = heroPhoto.parentElement;
    var heroRect = heroEl.getBoundingClientRect();
    var introEl = document.querySelector('.hero__intro-mobile');
    var introRect = introEl.getBoundingClientRect();
    return {
      left: introRect.left - heroRect.left + MOBILE_INTRO_PAD_X,
      top: introRect.bottom - heroRect.top + mobilePenGap.value,
      width: introRect.width - MOBILE_INTRO_PAD_X * 2
    };
  }

  // ノートPC画面の実際の4隅（写真のピクセル座標）。長方形の素材をこの4点にぴったり合わせる射影変換をかけることで、
  // PC本体の角度・遠近感と中身の見え方を一致させる（クリップだけだと中身が正面向きのまま浮いて見えるため）
  var laptopCorners = {
    tl: [793, 349], tr: [1258, 362], br: [1220, 710], bl: [754, 665]
  };
  var laptopLocalW = 495, laptopLocalH = 360;

  // スマホ専用写真（hero-mobile-base.png, 941x1672）内のノートPC画面の4隅。
  // canvasで画面の明るい領域（青空・海）をフラッドフィルして輪郭を検出し、算出した座標
  var laptopCornersMobile = {
    tl: [416, 924], tr: [825, 958], br: [786, 1278], bl: [385, 1215]
  };
  var laptopLocalWMobile = 369, laptopLocalHMobile = 292;

  // 単位正方形(0,0)-(W,0)-(W,H)-(0,H)を任意の四角形P0-P1-P2-P3に写す射影変換の係数を求める（Heckbertの手法）
  function computeHomography(W, H, P0, P1, P2, P3) {
    var x0 = P0[0], y0 = P0[1], x1 = P1[0], y1 = P1[1], x2 = P2[0], y2 = P2[1], x3 = P3[0], y3 = P3[1];
    var dx1 = x1 - x2, dy1 = y1 - y2, dx2 = x3 - x2, dy2 = y3 - y2;
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var denom = dx1 * dy2 - dx2 * dy1;
    var g = (sx * dy2 - dx2 * sy) / denom;
    var h = (dx1 * sy - sx * dy1) / denom;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
    var d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    return { a: a / W, b: b / H, c: c, d: d / W, e: e / H, f: f, g: g / W, h: h / H };
  }

  function currentScale() {
    var cTop = heroPhoto.parentElement;
    var contW = cTop.clientWidth, contH = cTop.clientHeight;
    var desktop = isDesktopBreakpoint();
    var refW = desktop ? REF_W : REF_W_MOBILE;
    var refH = desktop ? REF_H : REF_H_MOBILE;
    var scale = Math.max(contW / refW, contH / refH);
    var offX = (contW - refW * scale) / 2;
    // スマホ写真はobject-position:center topのため、はみ出し分は下側だけがクロップされる
    // （PC写真はcenter centerなので上下均等クロップのまま）。
    // .heroにmax-height（100svh）を掛けている関係で、縦長写真の場合ここが0にならない
    // ケースがあるため、object-positionと不一致が起きないよう分岐する
    var offY = desktop ? (contH - refH * scale) / 2 : 0;
    return { scale: scale, offX: offX, offY: offY };
  }

  function positionHeroOverlays() {
    var s = currentScale();
    var desktop = isDesktopBreakpoint();

    // 手書きコピー（#heroPenSvg）はPC・スマホ共通で常に位置を計算する
    var penBox = currentPenBoxPx();
    var penSvgEl = document.getElementById('heroPenSvg');
    penSvgEl.style.left = penBox.left + 'px';
    penSvgEl.style.top = penBox.top + 'px';
    penSvgEl.style.width = penBox.width + 'px';
    penSvgEl.style.height = (penBox.width * PEN_VIEWBOX_H / PEN_VIEWBOX_W) + 'px';

    // 見出しSVG・ノートPC画面の射影変換：見出しはPC版のみ、ノートPC画面ははめ込み先の
    // 4隅座標が違うだけでPC・スマホ共通の仕組み（射影変換）を使う
    if (!desktop) {
      function toRealMobile(pt) { return [s.offX + pt[0] * s.scale, s.offY + pt[1] * s.scale]; }
      var mP0 = toRealMobile(laptopCornersMobile.tl), mP1 = toRealMobile(laptopCornersMobile.tr);
      var mP2 = toRealMobile(laptopCornersMobile.br), mP3 = toRealMobile(laptopCornersMobile.bl);
      var mm = computeHomography(laptopLocalWMobile, laptopLocalHMobile, mP0, mP1, mP2, mP3);
      var mMatrix3d = 'matrix3d(' +
        mm.a + ',' + mm.d + ',0,' + mm.g + ',' +
        mm.b + ',' + mm.e + ',0,' + mm.h + ',' +
        '0,0,1,0,' +
        mm.c + ',' + mm.f + ',0,1)';
      var mobileMaskEl = document.getElementById('heroLaptopMaskMobile');
      if (mobileMaskEl) mobileMaskEl.style.transform = mMatrix3d;
      return;
    }

    var headlineRect = heroRects.heroHeadlineSvg;
    var headlineEl = document.getElementById('heroHeadlineSvg');
    headlineEl.style.left = (s.offX + headlineRect.left * s.scale) + 'px';
    headlineEl.style.top = (s.offY + headlineRect.top * s.scale) + 'px';
    headlineEl.style.width = (headlineRect.width * s.scale) + 'px';
    headlineEl.style.height = (headlineRect.height * s.scale) + 'px';

    // ノートPC画面：4隅を実際のレンダリング座標に変換し、495x360の素材ウィンドウをその4隅へ射影変換で合わせる
    function toReal(pt) { return [s.offX + pt[0] * s.scale, s.offY + pt[1] * s.scale]; }
    var P0 = toReal(laptopCorners.tl), P1 = toReal(laptopCorners.tr);
    var P2 = toReal(laptopCorners.br), P3 = toReal(laptopCorners.bl);
    var m = computeHomography(laptopLocalW, laptopLocalH, P0, P1, P2, P3);
    var matrix3d = 'matrix3d(' +
      m.a + ',' + m.d + ',0,' + m.g + ',' +
      m.b + ',' + m.e + ',0,' + m.h + ',' +
      '0,0,1,0,' +
      m.c + ',' + m.f + ',0,1)';
    document.getElementById('heroLaptopMask').style.transform = matrix3d;
  }
  positionHeroOverlays();
  // スマホはスクロール中にアドレスバーの表示/非表示で画面の実高さが変わり、その都度resizeが
  // 短時間に何度も連続発火する。毎回同期的に再計算すると、レイアウトが完全に落ち着く前の
  // 過渡的な値を拾ってしまい、ノートPC画面の射影変換が一瞬崩れて消えたように見えることがあった
  // （PCは通常スクロール中に画面サイズが変わらないため、この問題自体が起きない）。
  // resizeイベントを1フレームに1回へ間引き、常にその時点の最新値だけで計算し直すことで、
  // 過渡的な崩れた見た目が描画されないようにする
  var repositionRaf = null;
  function scheduleReposition() {
    if (repositionRaf) return;
    repositionRaf = requestAnimationFrame(function () {
      repositionRaf = null;
      positionHeroOverlays();
    });
  }
  window.addEventListener('resize', scheduleReposition);

  // イントロ表示中はjs/intro.jsがdocument.body.style.overflowを'hidden'にしてスクロールバーを消しており、
  // その分レイアウト幅が一時的に広がっている（スクロールバー分の増減はresizeイベントが発火しない）。
  // 最初のpositionHeroOverlays()はこのスクロールバー有無が確定する前後どちらかのタイミングで走ってしまい、
  // ノートPC画面のはめ込み位置が本編表示後の実際の幅とズレることがあるため、
  // イントロが完全に終わって最終的なレイアウトが確定したタイミングで必ず一度計算し直す。
  // あわせて、ノートPC画面のスクロールアニメーション（css/style.css側でanimation-play-state:pausedにしてある）も
  // ここで初めてrunningにする。CSSアニメーションはvisibility:hiddenの間も裏で進んでしまうため、
  // 最初からpausedにしておかないと本編が見えた瞬間には既にスクロールが数秒分進んだ状態になってしまう
  function startLaptopScroll() {
    positionHeroOverlays();
    var shotImg = document.querySelector('.hero__laptop-mask img');
    if (shotImg) shotImg.style.animationPlayState = 'running';
    var shotImgMobile = document.querySelector('.hero__laptop-mask-mobile img');
    if (shotImgMobile) shotImgMobile.style.animationPlayState = 'running';
    // スマホ専用カーテンも同じ理由（visibility:hidden中に裏でアニメーションが進んでしまう問題）で
    // pausedにしてあるため、ここで一緒にrunningへ切り替える
    var curtainImgMobile = document.querySelector('.hero__curtain-mobile img');
    if (curtainImgMobile) curtainImgMobile.style.animationPlayState = 'running';
  }
  if (window.__introReady) {
    startLaptopScroll();
  } else {
    document.addEventListener('intro:ready', startLaptopScroll, { once: true });
  }

  // js/hero-position-debug.js（?heropos=1のときだけ動く位置調整ツール）から、
  // 手書き風コピー（#heroPenSvg）の位置を直接動かして再配置できるようにするための最小限の窓口
  window.__heroDebugAPI = {
    mobilePenGap: mobilePenGap,
    currentScale: currentScale,
    reposition: positionHeroOverlays
  };

  // ---------- ノートPC画面の4隅を調整するキャリブレーションモード ----------
  // 通常は一切動かない（コスト・見た目とも影響なし）。URLに ?calibrate を付けて開いた時だけ有効になる
  // 例：index.html?calibrate
  // 開いた時の画面幅（768px未満かどうか）で、PC版（laptopCorners）とスマホ版（laptopCornersMobile）の
  // どちらを編集するか自動的に切り替わる。画面はめ込みの4隅に赤い丸のハンドルが表示されるので、
  // ドラッグして実際のノートPC画面の角に合わせる。右下のパネルに、その場でコピーできる座標コードが
  // 表示され続けるので、ズレが直ったらそれをコピーしてこのファイルの該当する変数に貼り替える
  if (/[?&]calibrate\b/.test(location.search)) {
    (function initLaptopCalibration() {
      var container = heroPhoto.parentElement; // #hero（position:relativeなので、これを基準に座標が取れる）
      var order = ['tl', 'tr', 'br', 'bl'];
      var labels = { tl: '左上', tr: '右上', br: '右下', bl: '左下' };

      // 開いた時点の画面幅で対象を固定する（ドラッグ中に途中で対象が入れ替わって混乱しないように）
      var targetIsDesktop = isDesktopBreakpoint();
      var corners = targetIsDesktop ? laptopCorners : laptopCornersMobile;
      var varName = targetIsDesktop ? 'laptopCorners' : 'laptopCornersMobile';

      var panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;background:rgba(20,30,35,0.9);' +
        'color:#8ef2c8;font:12px/1.5 monospace;padding:12px 14px;border-radius:10px;max-width:300px;' +
        'white-space:pre-wrap;box-shadow:0 4px 16px rgba(0,0,0,0.35);';
      var title = document.createElement('div');
      title.textContent = (targetIsDesktop ? 'PC版' : 'スマホ版') + 'ノートPC画面キャリブレーション（角をドラッグ）';
      title.style.cssText = 'color:#fff;font-weight:bold;margin-bottom:6px;';
      var note = document.createElement('div');
      note.textContent = targetIsDesktop
        ? '767px以下（スマホ幅）で開き直すとスマホ版の調整に切り替わります。'
        : '768px以上（PC幅）で開き直すとPC版の調整に切り替わります。';
      note.style.cssText = 'color:#cbd5df;margin-bottom:6px;font-size:11px;';
      var pre = document.createElement('div');
      var copyBtn = document.createElement('button');
      copyBtn.textContent = 'コードをコピー';
      copyBtn.style.cssText = 'display:block;margin-top:8px;padding:6px 12px;border:none;border-radius:6px;' +
        'background:#2f9e93;color:#fff;font-weight:bold;cursor:pointer;';
      panel.appendChild(title);
      panel.appendChild(note);
      panel.appendChild(pre);
      panel.appendChild(copyBtn);
      document.body.appendChild(panel);

      function cornerCode() {
        return 'var ' + varName + ' = {\n' +
          '  tl: [' + Math.round(corners.tl[0]) + ', ' + Math.round(corners.tl[1]) + '],\n' +
          '  tr: [' + Math.round(corners.tr[0]) + ', ' + Math.round(corners.tr[1]) + '],\n' +
          '  br: [' + Math.round(corners.br[0]) + ', ' + Math.round(corners.br[1]) + '],\n' +
          '  bl: [' + Math.round(corners.bl[0]) + ', ' + Math.round(corners.bl[1]) + ']\n' +
          '};';
      }

      copyBtn.addEventListener('click', function () {
        var text = cornerCode();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(function () {});
        }
        copyBtn.textContent = 'コピーしました！';
        setTimeout(function () { copyBtn.textContent = 'コードをコピー'; }, 1200);
      });

      var handles = {};
      order.forEach(function (key) {
        var handle = document.createElement('div');
        handle.title = labels[key];
        handle.style.cssText = 'position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;' +
          'border-radius:50%;background:rgba(255,70,70,0.85);border:2px solid #fff;' +
          'box-shadow:0 0 8px rgba(0,0,0,0.5);cursor:grab;z-index:9999;touch-action:none;';
        container.appendChild(handle);
        handles[key] = handle;
      });

      function updateHandles() {
        var s = currentScale();
        order.forEach(function (key) {
          var pt = corners[key];
          handles[key].style.left = (s.offX + pt[0] * s.scale) + 'px';
          handles[key].style.top = (s.offY + pt[1] * s.scale) + 'px';
        });
      }

      function refresh() {
        positionHeroOverlays();
        updateHandles();
        pre.textContent = cornerCode();
      }

      var draggingKey = null;

      function pointFromEvent(e) {
        var t = e.touches && e.touches[0];
        return { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY };
      }

      function onPointerDown(key) {
        return function (e) {
          draggingKey = key;
          handles[key].style.cursor = 'grabbing';
          e.preventDefault();
        };
      }

      function onPointerMove(e) {
        if (!draggingKey) return;
        e.preventDefault();
        var p = pointFromEvent(e);
        var rect = container.getBoundingClientRect();
        var s = currentScale();
        var photoX = (p.x - rect.left - s.offX) / s.scale;
        var photoY = (p.y - rect.top - s.offY) / s.scale;
        corners[draggingKey] = [photoX, photoY];
        refresh();
      }

      function onPointerUp() {
        if (draggingKey && handles[draggingKey]) handles[draggingKey].style.cursor = 'grab';
        draggingKey = null;
      }

      order.forEach(function (key) {
        handles[key].addEventListener('mousedown', onPointerDown(key));
        handles[key].addEventListener('touchstart', onPointerDown(key), { passive: false });
      });
      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
      window.addEventListener('resize', refresh);

      refresh();
    })();
  }

  // 万年筆が筆記体をなぞって書いているアニメーション。文字は左から右へ育つ矩形クリップで段階的に見せ、
  // ペン先は同じガイドパス上を getPointAtLength() で取得して、同じ進行度(progress)で同期させて動かす
  (function () {
    var penText = document.getElementById('penText');
    var penIcon = document.getElementById('penIcon');
    var guidePath = document.getElementById('penGuidePath');
    var revealRect = document.getElementById('penRevealRect');
    var DELAY = 600, DRAW_MS = 3200, FADE_MS = 500, HOLD_MS = 3000, RESET_MS = 500, REVEAL_W = 650;
    var CYCLE_MS = DELAY + DRAW_MS + FADE_MS + HOLD_MS + RESET_MS;
    var guideLen = guidePath.getTotalLength();
    var PEN_W = 132.3, PEN_H = 55, TIP_X = 3.15, TIP_Y = 38.72;
    // ガイドパスの座標系はSVGのviewBox基準（0-685）。表示箱の実際の幅はcurrentPenBoxPx().widthで
    // viewBoxの685とは異なるため、拡大率だけでなくこの縮小比も掛け合わせて実座標に変換する

    if (reduceMotion) {
      penText.style.opacity = '1';
      revealRect.setAttribute('width', String(REVEAL_W));
      penIcon.style.opacity = '0';
      return;
    }

    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function placePenAt(len) {
      var box = currentPenBoxPx();
      var svgLeftPx = box.left;
      var svgTopPx = box.top;
      var penScale = box.width / PEN_VIEWBOX_W;
      var clampedLen = Math.max(0, Math.min(guideLen, len));
      var p = guidePath.getPointAtLength(clampedLen);
      var p2 = guidePath.getPointAtLength(Math.max(0, Math.min(guideLen, clampedLen + 2)));
      var angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
      var wobble = Math.max(-10, Math.min(10, angle * 0.35));
      var realX = svgLeftPx + p.x * penScale;
      var realY = svgTopPx + p.y * penScale;
      var w = PEN_W * penScale, h = PEN_H * penScale, tipX = TIP_X * penScale, tipY = TIP_Y * penScale;
      penIcon.style.width = w + 'px';
      penIcon.style.height = h + 'px';
      penIcon.style.left = (realX - tipX) + 'px';
      penIcon.style.top = (realY - tipY) + 'px';
      penIcon.style.transformOrigin = tipX + 'px ' + tipY + 'px';
      penIcon.style.transform = 'rotate(' + wobble + 'deg)';
    }

    var startTime = null;
    function tick(now) {
      if (startTime === null) startTime = now;
      var elapsed = (now - startTime) % CYCLE_MS;

      if (elapsed < DELAY) {
        requestAnimationFrame(tick);
        return;
      }
      var drawElapsed = elapsed - DELAY;
      if (drawElapsed <= DRAW_MS) {
        penText.style.opacity = '1';
        var progress = easeInOutCubic(Math.min(1, drawElapsed / DRAW_MS));
        revealRect.setAttribute('width', String(progress * REVEAL_W));
        penIcon.style.opacity = '1';
        placePenAt(progress * guideLen);
        requestAnimationFrame(tick);
        return;
      }
      var fadeElapsed = drawElapsed - DRAW_MS;
      if (fadeElapsed <= FADE_MS) {
        revealRect.setAttribute('width', String(REVEAL_W));
        penIcon.style.opacity = String(1 - Math.min(1, fadeElapsed / FADE_MS));
        requestAnimationFrame(tick);
        return;
      }
      var holdElapsed = fadeElapsed - FADE_MS;
      if (holdElapsed <= HOLD_MS) {
        revealRect.setAttribute('width', String(REVEAL_W));
        penIcon.style.opacity = '0';
        requestAnimationFrame(tick);
        return;
      }
      var resetElapsed = holdElapsed - HOLD_MS;
      var rt = Math.min(1, resetElapsed / RESET_MS);
      penText.style.opacity = String(1 - rt);
      requestAnimationFrame(tick);
    }

    // イントロ演出中はこのアニメーションが裏で進んでしまい、本編が見えた瞬間には
    // 書き終わっている（＝唐突に見える）ため、イントロが完全に終わってから少し間を置いて開始する。
    // js/intro.jsがゲートを起動しない場合（PEフォールバック等）も含め、必ず'intro:ready'が発火する
    var START_DELAY_AFTER_INTRO = 150; // 本編が見えてから書き始めるまでの間（ms）
    function startPenLoop() {
      setTimeout(function () { requestAnimationFrame(tick); }, START_DELAY_AFTER_INTRO);
    }
    // 訪問済みの場合、js/intro.js側は読み込み直後に同期的に'intro:ready'を発火する。
    // このスクリプトの読み込み順によっては、addEventListenerする前に発火済みで聞き逃す可能性があるため、
    // まずすでに発火済みかどうかをwindow.__introReadyで確認する
    if (window.__introReady) {
      startPenLoop();
    } else {
      document.addEventListener('intro:ready', startPenLoop, { once: true });
    }
  })();
})();
