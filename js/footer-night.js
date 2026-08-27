// ===================================================
// Yui Portfolio - footer-night.js
// 夜の海Footer（STEP1）の演出：
//   STEP2 - マウスの動きに沿って水面に淡い波紋（hoverできる機器のみ）
//   STEP3 - クリック／タップ位置に小さな水しぶき（PC/タブレット/スマホ共通）
// 海鳥の退場演出はまだ実装しない（STEP4以降）。
// ===================================================
(function () {
  'use strict';

  var footer = document.querySelector('.site-footer');
  if (!footer) return; // 対象要素が無い場合は何もしない（他のJSには影響させない）

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isInteractiveTarget(target) {
    return !!(target && target.closest && target.closest('a, button'));
  }

  // ---------- STEP2：マウスの動きに沿った淡い波紋（hoverできる機器のみ） ----------
  (function initRipple() {
    var water = document.querySelector('.footer-night__water');
    if (!water) return;
    if (reduceMotion) return; // reduced-motion時は波紋自体を出さない
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // スマホ・タブレットでは再現しない

    var SPAWN_INTERVAL_MS = 280; // 波紋を生成する最短間隔（pointermoveごとに生成しない。ゆったりめに間引く）
    var RIPPLE_LIFETIME_MS = 2800; // css側の@keyframes footerRippleExpandの時間と合わせる
    var MAX_CONCURRENT = 12; // 万一animationendが発火しない場合の保険的な上限
    var lastSpawnAt = 0;

    function spawnRippleAt(x, y) {
      if (water.children.length >= MAX_CONCURRENT) return;
      var el = document.createElement('span');
      el.className = 'footer-ripple';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      water.appendChild(el);

      var removed = false;
      function remove() {
        if (removed) return;
        removed = true;
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      el.addEventListener('animationend', remove, { once: true });
      setTimeout(remove, RIPPLE_LIFETIME_MS + 300); // animationendが発火しない環境向けの保険
    }

    function handlePointer(e) {
      var now = performance.now();
      if (now - lastSpawnAt < SPAWN_INTERVAL_MS) return;
      lastSpawnAt = now;

      var rect = footer.getBoundingClientRect();
      spawnRippleAt(e.clientX - rect.left, e.clientY - rect.top);
    }

    footer.addEventListener('pointerenter', handlePointer);
    footer.addEventListener('pointermove', handlePointer);
  })();

  // ---------- STEP3：クリック／タップ位置に小さな水しぶき（PC/タブレット/スマホ共通） ----------
  (function initSplash() {
    var splashLayer = document.querySelector('.footer-splash-layer');
    if (!splashLayer) return;

    var TAP_MOVE_THRESHOLD = 10; // これを超えて動いたらスクロール/ドラッグとみなし、タップ扱いしない
    var MAX_SPLASH_GROUPS = 6; // 同時に残せるスプラッシュの数。超えたら古いものから削除
    var splashGroups = [];

    function pruneOldGroups() {
      while (splashGroups.length > MAX_SPLASH_GROUPS) {
        var old = splashGroups.shift();
        if (old && old.parentNode) old.parentNode.removeChild(old);
      }
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function spawnSplashAt(x, y) {
      var group = document.createElement('div');

      // クリック直後だけ水面がふっと明るくなるアクセント（波紋ではない）
      var accent = document.createElement('span');
      accent.className = 'water-splash-accent';
      accent.style.left = x + 'px';
      accent.style.top = y + 'px';
      group.appendChild(accent);

      if (reduceMotion) {
        // 簡略版：跳ねる水滴は出さず、ごく小さな点が一瞬フェードするだけ
        var dot = document.createElement('span');
        dot.className = 'water-splash-dot';
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        group.appendChild(dot);
      } else {
        var dropCount = 3 + Math.floor(Math.random() * 4); // 3〜6粒
        for (var i = 0; i < dropCount; i++) {
          // 0〜1の一様乱数を2乗して小さい値に偏らせる＝ほとんどが小粒、たまに大きめの粒になる
          var bias = Math.random() * Math.random();
          var size = 2 + bias * 8; // 2〜10px程度
          var dx = randomBetween(-35, 35);
          var dyUp = -randomBetween(15, 45);
          var dyDown = randomBetween(4, 14);
          var duration = randomBetween(0.6, 1.1);
          var delay = randomBetween(0, 0.06);

          var drop = document.createElement('span');
          drop.className = 'water-splash-drop';
          drop.style.left = x + 'px';
          drop.style.top = y + 'px';
          drop.style.width = size.toFixed(1) + 'px';
          drop.style.height = (size * 1.3).toFixed(1) + 'px';
          drop.style.marginLeft = (-size / 2).toFixed(1) + 'px';
          drop.style.marginTop = (-size * 1.3 / 2).toFixed(1) + 'px';
          drop.style.setProperty('--dx', dx.toFixed(1) + 'px');
          drop.style.setProperty('--dy-up', dyUp.toFixed(1) + 'px');
          drop.style.setProperty('--dy-down', dyDown.toFixed(1) + 'px');
          drop.style.setProperty('--drop-duration', duration.toFixed(2) + 's');
          drop.style.setProperty('--drop-delay', delay.toFixed(2) + 's');
          group.appendChild(drop);
        }
      }

      splashLayer.appendChild(group);
      splashGroups.push(group);
      pruneOldGroups();

      var lifetime = reduceMotion ? 550 : 1300; // 個々のanimation時間より少し長い安全マージン
      setTimeout(function () {
        if (group.parentNode) group.parentNode.removeChild(group);
        var idx = splashGroups.indexOf(group);
        if (idx !== -1) splashGroups.splice(idx, 1);
      }, lifetime);
    }

    var downX = null, downY = null;

    footer.addEventListener('pointerdown', function (e) {
      if (isInteractiveTarget(e.target)) {
        downX = null;
        downY = null;
        return; // リンク・ボタン操作を優先し、水しぶきは出さない
      }
      downX = e.clientX;
      downY = e.clientY;
    });

    footer.addEventListener('pointerup', function (e) {
      if (downX === null) return;
      var dx = e.clientX - downX;
      var dy = e.clientY - downY;
      var moved = Math.sqrt(dx * dx + dy * dy);
      downX = null;
      downY = null;

      if (moved > TAP_MOVE_THRESHOLD) return; // スクロール・ドラッグとみなしタップ扱いしない
      if (isInteractiveTarget(e.target)) return; // 離した瞬間にリンク上にあった場合も除外

      var rect = footer.getBoundingClientRect();
      spawnSplashAt(e.clientX - rect.left, e.clientY - rect.top);
    });
  })();
})();
