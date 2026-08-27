// ===================================================
// Yui Portfolio - twilight-fx.js
// 夕暮れの光エリア（使用ツール〜お問い合わせ／.twilight-zone）STEP B：
// 複数の流れ星ではなく、マウスに寄り添う「ひとつの光」がついてきて、ときどき小さく「キラッ」と瞬く演出。
// 昼（STEP A・js/daylight.js）から夜（Footer・js/footer-night.js）へ向かう時間の流れの中間部分を担当する。
// 光要素（#twilightLight）はDOM生成・削除を行わず、常に1個の要素の位置・色だけを更新する。
// hoverできる機器（PC/タブレットのマウス操作）のみで動作し、スマホ・prefers-reduced-motionでは
// 完全に無効化する（コンテンツ自体は通常表示のまま）。
// Footer（.site-footer）には一切のリスナーを付けない
// （.twilight-zone自体がContactセクションで閉じているため、構造的にもFooterへは広がらない。
//   zoneからpointerleaveした瞬間＝Footerに入った瞬間も同じフェードアウト処理で自然に消える）。
// footer-night.jsとはロジックを完全に分離している。
// ===================================================
(function () {
  'use strict';

  var zone = document.getElementById('twilightZone');
  var light = document.getElementById('twilightLight');
  if (!zone || !light) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // 追従・瞬きとも無効化。光自体も非表示のまま

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // スマホ・タブレットは完全無効

  var toolsEl = document.getElementById('tools');
  var worksEl = document.getElementById('works');
  var flowEl = document.getElementById('flow');
  var contactEl = document.getElementById('contact');

  // セクションごとに色味を少しずつ変える（Tools=少し明るめブルー→Contact=haloを白寄りにしてFooterの夜へ）
  var SECTIONS = [
    { el: toolsEl, core: '#6a9bad', halo: 'rgba(235, 249, 255, 0.45)' },
    { el: worksEl, core: '#5b8fa3', halo: 'rgba(235, 249, 255, 0.45)' },
    { el: flowEl, core: '#5b8fa3', halo: 'rgba(220, 241, 248, 0.42)' },
    { el: contactEl, core: '#4f8195', halo: 'rgba(245, 252, 255, 0.5)' }
  ];

  function sectionAt(clientY) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      if (!s.el) continue;
      var r = s.el.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return s;
    }
    return null;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ---------- マウスへの追従（rAF + lerp。カーソルの少し右上に浮かせる） ----------
  var OFFSET_X = 20;
  var OFFSET_Y = -20;
  var POS_LERP = 0.16; // 0.12〜0.2の目安。完全同期させず、ごくわずかに遅れて滑らかについてくる

  var targetX = 0, targetY = 0;
  var currentX = 0, currentY = 0;
  var hasTarget = false;
  var rafId = null;

  function tick() {
    currentX += (targetX - currentX) * POS_LERP;
    currentY += (targetY - currentY) * POS_LERP;
    light.style.setProperty('--light-x', currentX.toFixed(1) + 'px');
    light.style.setProperty('--light-y', currentY.toFixed(1) + 'px');

    var settled = Math.abs(targetX - currentX) < 0.3 && Math.abs(targetY - currentY) < 0.3;
    if (settled) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  function ensureLoop() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  // ---------- ときどき「キラッ」と瞬く ----------
  var KIRA_MIN_MS = 2200;
  var KIRA_MAX_MS = 4800;
  var KIRA_DURATION_MS = 450; // css側の@keyframes twilightRayFlash（0.45s）と合わせる
  var KIRA_COOLDOWN_MS = 1800; // 大きく動かした直後のボーナス発光でも、これ未満の間隔では再発光しない
  var MOVE_KIRA_THRESHOLD = 150; // これ以上一気に動いたら、ボーナスとして少し高確率で瞬かせる
  var MOVE_KIRA_PROBABILITY = 0.35;

  var kiraTimer = null;
  var lastKiraAt = 0;

  function fireKira() {
    light.classList.add('is-kira');
    lastKiraAt = performance.now();
    setTimeout(function () {
      light.classList.remove('is-kira');
    }, KIRA_DURATION_MS);
  }

  function scheduleKira() {
    clearTimeout(kiraTimer);
    kiraTimer = setTimeout(function () {
      fireKira();
      scheduleKira();
    }, randomBetween(KIRA_MIN_MS, KIRA_MAX_MS));
  }

  function stopKira() {
    clearTimeout(kiraTimer);
    kiraTimer = null;
    light.classList.remove('is-kira');
  }

  // ---------- pointer系イベント（#twilightZoneのみ。Footerには一切付けない） ----------
  zone.addEventListener('pointerenter', function (e) {
    light.classList.add('is-visible');
    var rect = zone.getBoundingClientRect();
    targetX = clamp(e.clientX - rect.left + OFFSET_X, 0, rect.width);
    targetY = clamp(e.clientY - rect.top + OFFSET_Y, 0, rect.height);
    if (!hasTarget) {
      // 初回はいきなり画面端（0,0）からlerpし始めると一瞬すっ飛んで見えるため、初期位置をそのまま代入する
      currentX = targetX;
      currentY = targetY;
      hasTarget = true;
    }
    var section = sectionAt(e.clientY);
    if (section) {
      light.style.setProperty('--light-core', section.core);
      light.style.setProperty('--light-halo', section.halo);
    }
    ensureLoop();
    scheduleKira();
  });

  var lastMoveX = null, lastMoveY = null;

  zone.addEventListener('pointermove', function (e) {
    var rect = zone.getBoundingClientRect();
    targetX = clamp(e.clientX - rect.left + OFFSET_X, 0, rect.width);
    targetY = clamp(e.clientY - rect.top + OFFSET_Y, 0, rect.height);

    var section = sectionAt(e.clientY);
    if (section) {
      light.style.setProperty('--light-core', section.core);
      light.style.setProperty('--light-halo', section.halo);
    }

    if (lastMoveX !== null) {
      var dx = e.clientX - lastMoveX;
      var dy = e.clientY - lastMoveY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= MOVE_KIRA_THRESHOLD) {
        var now = performance.now();
        if (now - lastKiraAt >= KIRA_COOLDOWN_MS && Math.random() < MOVE_KIRA_PROBABILITY) {
          fireKira();
          scheduleKira(); // 通常間隔のタイマーを仕切り直し、連続で光らないようにする
        }
      }
    }
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;

    ensureLoop();
  });

  zone.addEventListener('pointerleave', function () {
    light.classList.remove('is-visible');
    stopKira();
    lastMoveX = null;
    lastMoveY = null;
  });
})();
