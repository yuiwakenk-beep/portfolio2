// ===================================================
// Yui Portfolio - wall-light.js
// アーチ壁（#main左右のsand色の壁）に、マウスのX位置に応じてごく薄い自然光を
// 反応させる演出。カーソル自体には何も付けず、演出対象は左右の壁のgradient強度
// （CSSカスタムプロパティ）のみ。実際の描画はcss/style.css側のbody背景で行う。
// PC（hover:hover かつ pointer:fine）かつ、壁が十分見える幅（1025px以上）、
// かつ prefers-reduced-motion を希望しない場合のみ動作する。
// ===================================================
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (!window.matchMedia('(min-width: 1025px)').matches) return; // 壁がほぼ見えないタブレット/スマホでは動かさない

  var root = document.documentElement;

  // 中立時のalpha、マウスがどちらかへ寄った時の増減幅、外側stopの減衰比。
  // 「消灯→点灯」ではなく「少し明るい→ほんの少し明るくなる」程度に抑える
  var BASE_INNER = 0.04;
  var RANGE_INNER = 0.08; // inner alpha = BASE_INNER + intensity(0-1) * RANGE_INNER
  var OUTER_RATIO = 0.4; // 外側stopのalphaは内側の40%程度
  var LERP_FACTOR = 0.06; // 値が大きいほど追従が速い（0.04〜0.08の範囲で調整可）
  var NEUTRAL = 0.5;

  var targetX = NEUTRAL;
  var currentX = NEUTRAL;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  window.addEventListener('pointermove', function (e) {
    targetX = clamp01(e.clientX / window.innerWidth);
  }, { passive: true });

  // 画面外へ出たら急に消さず、中立（左右均等）へゆっくり戻す
  document.addEventListener('mouseleave', function () {
    targetX = NEUTRAL;
  });

  function applySide(prefix, intensity) {
    var inner = BASE_INNER + intensity * RANGE_INNER;
    var outer = inner * OUTER_RATIO;
    root.style.setProperty('--wall-light-' + prefix + '-alpha', inner.toFixed(3));
    root.style.setProperty('--wall-light-' + prefix + '-alpha-outer', outer.toFixed(3));
  }

  function tick() {
    currentX += (targetX - currentX) * LERP_FACTOR;

    applySide('left', 1 - currentX);
    applySide('right', currentX);

    requestAnimationFrame(tick);
  }

  tick();
})();
