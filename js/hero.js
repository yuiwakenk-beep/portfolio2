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

  // 写真は object-fit:cover で表示されるため、実際の表示上のトリミング量を計算して
  // オーバーレイ（見出し・手書きテキスト・PC画面）の位置を写真に正確に合わせる
  var heroRects = {
    heroHeadlineSvg: { left: 47, top: 260, width: 636, height: 78 },
    heroPenSvg:       { left: 90, top: 308, width: 534, height: 92 }
  };
  var heroTextRect = heroRects.heroPenSvg;

  // ノートPC画面の実際の4隅（写真のピクセル座標）。長方形の素材をこの4点にぴったり合わせる射影変換をかけることで、
  // PC本体の角度・遠近感と中身の見え方を一致させる（クリップだけだと中身が正面向きのまま浮いて見えるため）
  var laptopCorners = {
    tl: [796, 350], tr: [1256, 360], br: [1219, 709], bl: [755, 663]
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
    var natW = heroPhoto.naturalWidth, natH = heroPhoto.naturalHeight;
    var cTop = heroPhoto.parentElement;
    var contW = cTop.clientWidth, contH = cTop.clientHeight;
    var scale = Math.max(contW / natW, contH / natH);
    var offX = (contW - natW * scale) / 2;
    var offY = (contH - natH * scale) / 2;
    return { scale: scale, offX: offX, offY: offY };
  }

  function positionHeroOverlays() {
    if (!heroPhoto.naturalWidth || !heroPhoto.naturalHeight) return;
    var s = currentScale();
    Object.keys(heroRects).forEach(function (id) {
      var el = document.getElementById(id);
      var r = heroRects[id];
      el.style.left = (s.offX + r.left * s.scale) + 'px';
      el.style.top = (s.offY + r.top * s.scale) + 'px';
      el.style.width = (r.width * s.scale) + 'px';
      el.style.height = (r.height * s.scale) + 'px';
    });

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
  if (heroPhoto.complete) { positionHeroOverlays(); } else { heroPhoto.addEventListener('load', positionHeroOverlays); }
  window.addEventListener('resize', positionHeroOverlays);

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
    // ガイドパスの座標系はSVGのviewBox基準（0-685）。表示箱の実際の幅はheroTextRect.widthで
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
      var svgLeftPx = s.offX + heroTextRect.left * s.scale;
      var svgTopPx = s.offY + heroTextRect.top * s.scale;
      var penScale = (heroTextRect.width * s.scale) / PEN_VIEWBOX_W;
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
    requestAnimationFrame(tick);
  })();
})();
