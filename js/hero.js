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
  // hero-mobile.png（スマホ専用写真）の基準キャンバスサイズ
  var REF_W_MOBILE = 853, REF_H_MOBILE = 1844;

  // 写真は object-fit:cover で表示されるため、実際の表示上のトリミング量を計算して
  // オーバーレイ（見出し・手書きテキスト・PC画面）の位置を写真に正確に合わせる
  var heroRects = {
    heroHeadlineSvg: { left: 47, top: 260, width: 636, height: 78 },
    heroPenSvg:       { left: 90, top: 308, width: 534, height: 92 }
  };
  // スマホ写真用の手書きコピー位置（見出しSVG・ノートPC画面はスマホでは非表示のため、ここには持たない）。
  // 写真の空（雲の少ない開けた部分）を目安にした初期値。実機で見た目を確認しながら調整する
  var heroRectsMobile = {
    heroPenSvg: { left: 21.2, top: 439.4, width: 700, height: 120 }
  };

  function isDesktopBreakpoint() {
    return window.matchMedia('(min-width: 768px)').matches;
  }

  // 手書きコピーの現在有効な矩形（PC/スマホ）。ペン先アニメーション側から毎フレーム呼ばれる
  function currentTextRect() {
    return isDesktopBreakpoint() ? heroRects.heroPenSvg : heroRectsMobile.heroPenSvg;
  }

  // ノートPC画面の実際の4隅（写真のピクセル座標）。長方形の素材をこの4点にぴったり合わせる射影変換をかけることで、
  // PC本体の角度・遠近感と中身の見え方を一致させる（クリップだけだと中身が正面向きのまま浮いて見えるため）
  var laptopCorners = {
    tl: [793, 349], tr: [1258, 362], br: [1220, 710], bl: [754, 665]
  };
  var laptopLocalW = 495, laptopLocalH = 360;

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
    var offY = (contH - refH * scale) / 2;
    return { scale: scale, offX: offX, offY: offY };
  }

  function positionHeroOverlays() {
    var s = currentScale();
    var desktop = isDesktopBreakpoint();

    // 手書きコピー（#heroPenSvg）はPC・スマホ共通で常に位置を計算する
    var penRect = currentTextRect();
    var penSvgEl = document.getElementById('heroPenSvg');
    penSvgEl.style.left = (s.offX + penRect.left * s.scale) + 'px';
    penSvgEl.style.top = (s.offY + penRect.top * s.scale) + 'px';
    penSvgEl.style.width = (penRect.width * s.scale) + 'px';
    penSvgEl.style.height = (penRect.height * s.scale) + 'px';

    // 見出しSVG・ノートPC画面の射影変換はPC版のみ（スマホでは要素自体が非表示のため計算しない）
    if (!desktop) return;

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
  window.addEventListener('resize', positionHeroOverlays);

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
  }
  if (window.__introReady) {
    startLaptopScroll();
  } else {
    document.addEventListener('intro:ready', startLaptopScroll, { once: true });
  }

  // js/hero-position-debug.js（?heropos=1のときだけ動く位置調整ツール）から、
  // 手書き風コピー（#heroPenSvg）の位置を直接動かして再配置できるようにするための最小限の窓口
  window.__heroDebugAPI = {
    heroRectsMobile: heroRectsMobile,
    currentScale: currentScale,
    reposition: positionHeroOverlays
  };

  // ---------- ノートPC画面の4隅を調整するキャリブレーションモード ----------
  // 通常は一切動かない（コスト・見た目とも影響なし）。URLに ?calibrate を付けて開いた時だけ有効になる
  // 例：index.html?calibrate
  // 画面はめ込みの4隅（laptopCorners）に赤い丸のハンドルが表示されるので、ドラッグしてPC画面の
  // 実際の角に合わせる。右下のパネルに、その場でコピーできる座標（laptopCorners用のコード）が
  // 表示され続けるので、ズレが直ったらそれをコピーしてこのファイルの laptopCorners に貼り替える
  if (/[?&]calibrate\b/.test(location.search)) {
    (function initLaptopCalibration() {
      var container = heroPhoto.parentElement; // #hero（position:relativeなので、これを基準に座標が取れる）
      var order = ['tl', 'tr', 'br', 'bl'];
      var labels = { tl: '左上', tr: '右上', br: '右下', bl: '左下' };

      var panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;background:rgba(20,30,35,0.9);' +
        'color:#8ef2c8;font:12px/1.5 monospace;padding:12px 14px;border-radius:10px;max-width:300px;' +
        'white-space:pre-wrap;box-shadow:0 4px 16px rgba(0,0,0,0.35);';
      var title = document.createElement('div');
      title.textContent = 'PC画面キャリブレーション（角をドラッグ）';
      title.style.cssText = 'color:#fff;font-weight:bold;margin-bottom:6px;';
      var pre = document.createElement('div');
      var copyBtn = document.createElement('button');
      copyBtn.textContent = 'コードをコピー';
      copyBtn.style.cssText = 'display:block;margin-top:8px;padding:6px 12px;border:none;border-radius:6px;' +
        'background:#2f9e93;color:#fff;font-weight:bold;cursor:pointer;';
      panel.appendChild(title);
      panel.appendChild(pre);
      panel.appendChild(copyBtn);
      document.body.appendChild(panel);

      function cornerCode() {
        return 'var laptopCorners = {\n' +
          '  tl: [' + Math.round(laptopCorners.tl[0]) + ', ' + Math.round(laptopCorners.tl[1]) + '],\n' +
          '  tr: [' + Math.round(laptopCorners.tr[0]) + ', ' + Math.round(laptopCorners.tr[1]) + '],\n' +
          '  br: [' + Math.round(laptopCorners.br[0]) + ', ' + Math.round(laptopCorners.br[1]) + '],\n' +
          '  bl: [' + Math.round(laptopCorners.bl[0]) + ', ' + Math.round(laptopCorners.bl[1]) + ']\n' +
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
          var pt = laptopCorners[key];
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
        laptopCorners[draggingKey] = [photoX, photoY];
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
    // ガイドパスの座標系はSVGのviewBox基準（0-685）。表示箱の実際の幅はcurrentTextRect().widthで
    // viewBoxの685とは異なるため、写真の拡大率(s.scale)だけでなくこの縮小比も掛け合わせて実座標に変換する
    var PEN_VIEWBOX_W = 685;

    if (reduceMotion) {
      penText.style.opacity = '1';
      revealRect.setAttribute('width', String(REVEAL_W));
      penIcon.style.opacity = '0';
      return;
    }

    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function placePenAt(len) {
      var s = currentScale();
      var textRect = currentTextRect();
      var svgLeftPx = s.offX + textRect.left * s.scale;
      var svgTopPx = s.offY + textRect.top * s.scale;
      var penScale = (textRect.width * s.scale) / PEN_VIEWBOX_W;
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
