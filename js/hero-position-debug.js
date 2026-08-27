// ===================================================
// Yui Portfolio - hero-position-debug.js
// 【納品物には含めない開発用ツール（意図的に有効化するまで動かないPEフォールバック）】
// スマホ版ファーストビューの (1) 見出しブロック（.hero__intro-mobile）と
// (2) 手書き風の英文コピー（#heroPenSvg）を、画面上で直接ドラッグして
// 位置を微調整するためのパネル。確定した位置はCSSスニペットとしてコピーできる。
// URLに ?heropos=1 を付けたとき・かつ画面幅が767px以下のときだけ動作する。
// ===================================================
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  if (!params.has('heropos')) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (!window.matchMedia('(max-width: 767px)').matches) {
      console.warn('hero-position-debug: 767px以下（スマホ幅）でのみ動作します。ブラウザ幅を狭くするか、開発者ツールのデバイスモードをお使いください。');
      return;
    }

    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:99999;' +
      'background:rgba(20,30,40,0.92);color:#fff;font:12px/1.5 sans-serif;' +
      'padding:12px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);' +
      'max-height:70vh;overflow-y:auto;';
    document.body.appendChild(panel);

    initTitleDrag(panel);
    initPenSvgDrag(panel);
  }

  // 数値を見やすく丸める（小数第1位まで）
  function round(n) {
    return Math.round(n * 10) / 10;
  }

  // 要素に現在かかっているtransform: translate(x, y)を読み取る（初回はCSSで設定済みの位置から続きを調整できるように）
  function parseTranslate(el) {
    var t = window.getComputedStyle(el).transform;
    if (!t || t === 'none') return { x: 0, y: 0 };
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var parts = m[1].split(',').map(function (v) { return parseFloat(v); });
      return { x: parts[4] || 0, y: parts[5] || 0 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var p = m3[1].split(',').map(function (v) { return parseFloat(v); });
      return { x: p[12] || 0, y: p[13] || 0 };
    }
    return { x: 0, y: 0 };
  }

  function copyText(text, statusEl, outputEl) {
    function afterCopySuccess() {
      statusEl.textContent = 'コピーしました';
    }
    function fallback() {
      outputEl.focus();
      outputEl.select();
      statusEl.textContent = '下の欄を選択済みです（Ctrl+Cでコピー）';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(afterCopySuccess).catch(fallback);
    } else {
      fallback();
    }
  }

  // ---------- (1) 見出しブロック（.hero__intro-mobile）のドラッグ調整 ----------
  function initTitleDrag(panel) {
    var target = document.querySelector('.hero__intro-mobile');
    if (!target) return;

    var start = parseTranslate(target);
    var dx = start.x;
    var dy = start.y;

    function render() {
      target.style.transform = 'translate(' + round(dx) + 'px, ' + round(dy) + 'px)';
    }

    function buildSnippet() {
      return '.hero__intro-mobile {\n  transform: translate(' + round(dx) + 'px, ' + round(dy) + 'px);\n}';
    }

    target.style.cursor = 'grab';
    target.style.outline = '2px dashed rgba(255, 120, 90, 0.85)';
    target.style.outlineOffset = '4px';

    var dragging = false;
    var startX = 0, startY = 0, baseDx = 0, baseDy = 0;

    function pointerDown(e) {
      dragging = true;
      target.style.cursor = 'grabbing';
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      baseDx = dx;
      baseDy = dy;
      e.preventDefault();
    }
    function pointerMove(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      dx = baseDx + (p.clientX - startX);
      dy = baseDy + (p.clientY - startY);
      render();
      sync();
    }
    function pointerUp() {
      dragging = false;
      target.style.cursor = 'grab';
    }

    target.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    target.addEventListener('touchstart', pointerDown, { passive: false });
    window.addEventListener('touchmove', pointerMove, { passive: false });
    window.addEventListener('touchend', pointerUp);

    var section = document.createElement('div');
    section.style.cssText = 'margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.2);';
    section.innerHTML =
      '<div style="font-weight:bold;margin-bottom:6px;">見出しテキストの位置調整</div>' +
      '<div style="color:#cbd5df;margin-bottom:6px;">オレンジの点線枠をドラッグして動かせます</div>' +
      '<div id="hp-title-val" style="margin-bottom:6px;"></div>' +
      '<div style="display:flex;gap:6px;">' +
      '<button id="hp-title-reset" type="button" style="flex:1;padding:8px;">リセット</button>' +
      '<button id="hp-title-copy" type="button" style="flex:1;padding:8px;">位置をコピー</button>' +
      '</div>' +
      '<div id="hp-title-status" style="margin-top:4px;min-height:14px;color:#8ee6a8;"></div>' +
      '<textarea id="hp-title-output" readonly style="width:100%;height:44px;margin-top:6px;' +
      'font:11px/1.4 monospace;box-sizing:border-box;"></textarea>' +
      '<div style="margin-top:6px;color:#cbd5df;">css/responsive.cssの .hero__intro-mobile { ... } に貼り付けてください。</div>';
    panel.appendChild(section);

    var valEl = section.querySelector('#hp-title-val');
    var outputEl = section.querySelector('#hp-title-output');
    var statusEl = section.querySelector('#hp-title-status');

    function sync() {
      valEl.textContent = '現在の移動量：X ' + round(dx) + 'px / Y ' + round(dy) + 'px';
      outputEl.value = buildSnippet();
    }

    section.querySelector('#hp-title-reset').addEventListener('click', function () {
      dx = 0;
      dy = 0;
      render();
      sync();
      statusEl.textContent = '';
    });
    section.querySelector('#hp-title-copy').addEventListener('click', function () {
      copyText(buildSnippet(), statusEl, outputEl);
    });

    render();
    sync();
  }

  // ---------- (2) 手書き風の英文コピー（#heroPenSvg）のドラッグ調整 ----------
  // 位置はCSSではなくjs/hero.jsが写真の比率に合わせて毎回計算しているため、
  // ここではjs/hero.jsが公開しているwindow.__heroDebugAPI経由で基準座標（heroRectsMobile.heroPenSvg）
  // 自体を書き換え、js/hero.js側の再配置処理を呼び直す方式にする
  function initPenSvgDrag(panel) {
    var api = window.__heroDebugAPI;
    var target = document.getElementById('heroPenSvg');
    if (!api || !target) return;

    var rect = api.heroRectsMobile.heroPenSvg;
    var startLeft = rect.left;
    var startTop = rect.top;

    target.style.outline = '2px dashed rgba(90, 160, 255, 0.85)';
    target.style.outlineOffset = '2px';
    target.style.cursor = 'grab';
    target.style.pointerEvents = 'auto'; // 通常はクリックを透過させるためpointer-events:noneが効いているので、調整中だけ解除する

    var dragging = false;
    var startX = 0, startY = 0, baseLeft = 0, baseTop = 0;

    function pointerDown(e) {
      dragging = true;
      target.style.cursor = 'grabbing';
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      baseLeft = rect.left;
      baseTop = rect.top;
      e.preventDefault();
    }
    function pointerMove(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      var scale = api.currentScale().scale;
      rect.left = baseLeft + (p.clientX - startX) / scale;
      rect.top = baseTop + (p.clientY - startY) / scale;
      api.reposition();
      sync();
    }
    function pointerUp() {
      dragging = false;
      target.style.cursor = 'grab';
    }

    target.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    target.addEventListener('touchstart', pointerDown, { passive: false });
    window.addEventListener('touchmove', pointerMove, { passive: false });
    window.addEventListener('touchend', pointerUp);

    var section = document.createElement('div');
    section.innerHTML =
      '<div style="font-weight:bold;margin-bottom:6px;">英文（手書き風コピー）の位置調整</div>' +
      '<div style="color:#cbd5df;margin-bottom:6px;">青の点線枠をドラッグして動かせます</div>' +
      '<div id="hp-pen-val" style="margin-bottom:6px;"></div>' +
      '<div style="display:flex;gap:6px;">' +
      '<button id="hp-pen-reset" type="button" style="flex:1;padding:8px;">リセット</button>' +
      '<button id="hp-pen-copy" type="button" style="flex:1;padding:8px;">位置をコピー</button>' +
      '</div>' +
      '<div id="hp-pen-status" style="margin-top:4px;min-height:14px;color:#8ee6a8;"></div>' +
      '<textarea id="hp-pen-output" readonly style="width:100%;height:44px;margin-top:6px;' +
      'font:11px/1.4 monospace;box-sizing:border-box;"></textarea>' +
      '<div style="margin-top:6px;color:#cbd5df;">js/hero.jsの heroRectsMobile.heroPenSvg を貼り替えてください。</div>';
    panel.appendChild(section);

    var valEl = section.querySelector('#hp-pen-val');
    var outputEl = section.querySelector('#hp-pen-output');
    var statusEl = section.querySelector('#hp-pen-status');

    function buildSnippet() {
      return '  heroRectsMobile: {\n' +
        '    heroPenSvg: { left: ' + round(rect.left) + ', top: ' + round(rect.top) +
        ', width: ' + rect.width + ', height: ' + rect.height + ' }\n' +
        '  }';
    }
    function sync() {
      valEl.textContent = '現在位置：left ' + round(rect.left) + ' / top ' + round(rect.top) + '（写真の基準座標）';
      outputEl.value = buildSnippet();
    }

    section.querySelector('#hp-pen-reset').addEventListener('click', function () {
      rect.left = startLeft;
      rect.top = startTop;
      api.reposition();
      sync();
      statusEl.textContent = '';
    });
    section.querySelector('#hp-pen-copy').addEventListener('click', function () {
      copyText(buildSnippet(), statusEl, outputEl);
    });

    sync();
  }
})();
