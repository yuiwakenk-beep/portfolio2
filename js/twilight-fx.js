// ===================================================
// Yui Portfolio - twilight-fx.js
// 夕暮れの光エリア（使用ツール〜お問い合わせ／.twilight-zone）STEP B：
// マウスに常駐する光は置かず、一定量マウスを動かした時だけ、その付近に
// 小さな光が一度だけ「キラッ」と現れてすぐ消える演出。
// 昼（STEP A・js/daylight.js）から夜（Footer・js/footer-night.js）へ向かう時間の流れの中間部分を担当する。
// キラッ要素は発生のたびにDOM生成し、animationend（＋保険のsetTimeout）で確実に削除する
// （footer-night.jsの波紋・水しぶきと同じ「都度生成→消滅」方式。常駐オブジェクトは持たない）。
// hoverできる機器（PC/タブレットのマウス操作）のみで動作し、スマホ・prefers-reduced-motionでは
// 完全に無効化する（コンテンツ自体は通常表示のまま）。
// Footer（.site-footer）には一切のリスナーを付けない
// （.twilight-zone自体がContactセクションで閉じているため、構造的にもFooterへは広がらない。
//   発生中のキラッはpointerleave後も強制削除せず、自身のアニメーションで自然に消える）。
// footer-night.jsとはロジックを完全に分離している。
// ===================================================
(function () {
  'use strict';

  var zone = document.getElementById('twilightZone');
  var layer = zone ? zone.querySelector('.twilight-light-layer') : null;
  if (!zone || !layer) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // キラッ自体を発生させない

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // スマホ・タブレットは完全無効

  var toolsEl = document.getElementById('tools');
  var worksEl = document.getElementById('works');
  var flowEl = document.getElementById('flow');
  var contactEl = document.getElementById('contact');

  // セクションごとに色味を少しずつ変える（Tools=少し明るめブルー→Contact=白寄りにしてFooterの夜へ）
  var SECTIONS = [
    { el: toolsEl, core: '#6a9bad' },
    { el: worksEl, core: '#5b8fa3' },
    { el: flowEl, core: '#5b8fa3' },
    { el: contactEl, core: '#4f8195' }
  ];
  var DEFAULT_CORE = '#5b8fa3';

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

  // ---------- キラッの発生条件・見た目 ----------
  var MOVE_THRESHOLD = 140; // 前回発光位置からこれ以上動いた場合のみ発生判定（100〜180px目安）
  var MIN_INTERVAL_MS = 1000; // 前回発光からこれ以上経過している場合のみ発生判定（700〜1500ms目安）
  var SPAWN_PROBABILITY = 0.7; // 条件を満たした上でのさらに抽選（60〜80%目安）
  var JITTER_MIN = 10, JITTER_MAX = 30; // ポインタ位置からのランダムなずらし幅（px）
  var MAX_CONCURRENT_KIRA = 3; // 同時表示数の上限。超えたら最も古いものから削除
  var KIRA_LIFETIME_MS = 500; // css側の@keyframes kiraFlash（0.5s）と合わせる

  var lastSpawnX = null, lastSpawnY = null;
  var lastSpawnAt = 0;
  var activeKira = [];

  function pruneOldestIfAtCap() {
    while (activeKira.length >= MAX_CONCURRENT_KIRA) {
      var old = activeKira.shift();
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
  }

  function spawnKiraAt(x, y, core) {
    var el = document.createElement('span');
    el.className = 'kira';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--kira-core', core);
    el.innerHTML =
      '<span class="kira__core"></span>' +
      '<span class="kira__ray kira__ray--h"></span>' +
      '<span class="kira__ray kira__ray--v"></span>' +
      '<span class="kira__ray kira__ray--d1"></span>' +
      '<span class="kira__ray kira__ray--d2"></span>';

    var removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      if (el.parentNode) el.parentNode.removeChild(el);
      var idx = activeKira.indexOf(el);
      if (idx !== -1) activeKira.splice(idx, 1);
    }
    el.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, KIRA_LIFETIME_MS + 300); // animationendが発火しない場合の保険

    layer.appendChild(el);
    activeKira.push(el);
  }

  function trySpawnKira(clientX, clientY) {
    if (lastSpawnX !== null) {
      var dx = clientX - lastSpawnX;
      var dy = clientY - lastSpawnY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOVE_THRESHOLD) return;
    }

    var now = performance.now();
    if (now - lastSpawnAt < MIN_INTERVAL_MS) return;

    if (Math.random() >= SPAWN_PROBABILITY) return;

    var rect = zone.getBoundingClientRect();
    var angle = randomBetween(0, Math.PI * 2);
    var jitter = randomBetween(JITTER_MIN, JITTER_MAX);
    var x = clamp(clientX - rect.left + Math.cos(angle) * jitter, 0, rect.width);
    var y = clamp(clientY - rect.top + Math.sin(angle) * jitter, 0, rect.height);

    var section = sectionAt(clientY);
    var core = section ? section.core : DEFAULT_CORE;

    pruneOldestIfAtCap();
    spawnKiraAt(x, y, core);

    // 実際に発生できた時だけ基準位置・時刻を更新する（発光しなかった移動ではゲートをリセットしない）
    lastSpawnX = clientX;
    lastSpawnY = clientY;
    lastSpawnAt = now;
  }

  // ---------- pointer系イベント（#twilightZoneのみ。Footerには一切付けない） ----------
  zone.addEventListener('pointermove', function (e) {
    trySpawnKira(e.clientX, e.clientY);
  });

  zone.addEventListener('pointerleave', function () {
    // 発生中のキラッは強制削除せず、自身のアニメーションで自然にフェードアウトさせる
    lastSpawnX = null;
    lastSpawnY = null;
  });
})();
