// ===================================================
// Yui Portfolio - cta-splash.js
// ページ内のCTAボタン（Hero・お問い合わせ等）に触れたとき、ボタンの外側（上方向）へ
// 小さな水しぶきが上がる演出。クリックだとページ遷移・スクロールが始まってしまい
// 見えないまま消えるため、触れた瞬間（pointerenter）で発火させる。
// js/footer-night.js のSTEP3（夜の海の水面をクリックしたときの水しぶき）と同じ見た目
// （css側の.water-splash-*）を共有し、ボタンからはみ出しても他の要素に切り取られないよう、
// ページ全体に重ねたposition:fixedの共有レイヤーに描く。
// ===================================================
(function () {
  'use strict';

  var targets = document.querySelectorAll('.hero-cta, .btn--primary');
  if (!targets.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var layer = document.createElement('div');
  layer.className = 'cta-splash-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

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
        var dyUp = -randomBetween(18, 48);
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

    layer.appendChild(group);
    splashGroups.push(group);
    pruneOldGroups();

    var lifetime = reduceMotion ? 550 : 1300;
    setTimeout(function () {
      if (group.parentNode) group.parentNode.removeChild(group);
      var idx = splashGroups.indexOf(group);
      if (idx !== -1) splashGroups.splice(idx, 1);
    }, lifetime);
  }

  // クリック（タップ）だと発火直後にページ遷移・スクロールが始まり、跳ねる様子が見えないまま
  // 消えてしまうため、「触れた瞬間」に見える程度に発火が早いpointerenterを使う
  var COOLDOWN_MS = 500; // 連続hoverで出しすぎないための間隔

  targets.forEach(function (cta) {
    var lastSpawn = 0;
    cta.addEventListener('pointerenter', function () {
      var now = Date.now();
      if (now - lastSpawn < COOLDOWN_MS) return;
      lastSpawn = now;

      var rect = cta.getBoundingClientRect();
      // ボタンの外（上辺のやや上）から水しぶきが上がって見えるよう、上辺中央付近を起点にする
      var originX = rect.left + rect.width * (0.35 + Math.random() * 0.3);
      var originY = rect.top;
      spawnSplashAt(originX, originY);
    });
  });
})();
