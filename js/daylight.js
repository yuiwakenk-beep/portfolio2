// ===================================================
// Yui Portfolio - daylight.js
// 昼の光エリア（自己紹介〜対応できること／.daylight-zone）STEP A：
// マウスの動きに合わせて、ごく淡い太陽光がこちらへ差し込むように見せる演出。
// 太陽本体はマウスに追従させない（CSS側の--daylight-x/--daylight-yの初期値＝画面右上あたりが
// 「固定された光源」で、そこから淡いニュアンスが変化するだけ）。
// hoverできる機器（PC/タブレットのマウス操作）のみ追従し、タッチ端末・prefers-reduced-motionでは
// css/style.cssの.daylight-zoneに定義した固定値（intensity:1の淡い光）がそのまま効く（PEフォールバック）。
// 対象はTools以降には一切広がらない（.daylight-zone自体がSkillsセクションで閉じているため、
// このスクリプトのpointerイベントもTools以降では発火しない）。
// ===================================================
(function () {
  'use strict';

  var zone = document.getElementById('daylightZone');
  if (!zone) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // CSSの固定値（画面右上あたりの淡い光）のまま。マウス追従はしない

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // タッチ端末はCSSの固定値のまま

  // CSS側の初期値（.daylight-zoneの--daylight-x/--daylight-y）と揃えておく
  var targetXPct = 70, targetYPct = 12;
  var currentXPct = targetXPct, currentYPct = targetYPct;
  var targetIntensity = 0, currentIntensity = 0;
  var rafId = null;

  // 1:1で追わず、毎フレームわずかに近づけるだけ＝「光の中心がほんの少しこちらへ寄る」程度に留める
  var POS_LERP = 0.06;
  var INTENSITY_LERP = 0.05;

  function tick() {
    currentXPct += (targetXPct - currentXPct) * POS_LERP;
    currentYPct += (targetYPct - currentYPct) * POS_LERP;
    currentIntensity += (targetIntensity - currentIntensity) * INTENSITY_LERP;

    zone.style.setProperty('--daylight-x', currentXPct.toFixed(2) + '%');
    zone.style.setProperty('--daylight-y', currentYPct.toFixed(2) + '%');
    zone.style.setProperty('--daylight-intensity', currentIntensity.toFixed(3));

    var posSettled = Math.abs(targetXPct - currentXPct) < 0.05 && Math.abs(targetYPct - currentYPct) < 0.05;
    var intensitySettled = Math.abs(targetIntensity - currentIntensity) < 0.002;
    if (posSettled && intensitySettled) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  // JS有効時は「入ってきたらフェードイン」の演出にするため、初期状態は光ゼロから始める
  zone.style.setProperty('--daylight-intensity', '0');

  zone.addEventListener('pointerenter', function () {
    targetIntensity = 1;
    ensureLoop();
  });

  zone.addEventListener('pointermove', function (e) {
    var rect = zone.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) return;
    targetXPct = ((e.clientX - rect.left) / rect.width) * 100;
    targetYPct = ((e.clientY - rect.top) / rect.height) * 100;
    // ページ読み込み時点で既にマウスがこのエリアの上にあると、ブラウザはpointerenterを発火しない
    // （実際に外から入ってきた場合しか発火しないため）。その場合でもここでintensityを立てることで
    // 光がフェードインする。既にintensityが1の場合は何もしないのと同じなので、常に立てて問題ない
    targetIntensity = 1;
    ensureLoop();
  });

  zone.addEventListener('pointerleave', function () {
    targetIntensity = 0;
    ensureLoop();
  });
})();
