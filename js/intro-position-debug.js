// ===================================================
// Yui Portfolio - intro-position-debug.js
// 【納品物には含めない開発用ツール】
// イントロの白波画像（sozai/intro-wave-foam.png = .intro-scene__foam）のobject-positionを
// 画面上のスライダーで調整し、確定した数値をCSS用テキストとしてコピーするためのパネル。
// 背景写真(.intro-scene__bg)・瓶(#introBottle)には一切触れない。
// URLに ?posdebug=1 を付けたときだけ動作し、それ以外（通常閲覧・納品版）では何もしない。
// ===================================================
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  if (!params.has('posdebug')) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var gate = document.getElementById('introGate');
    var foam = document.querySelector('.intro-scene__foam');
    var bottle = document.getElementById('introBottle');
    if (!gate || !foam) return;

    // reduced-motion・訪問済み等でjs/intro.js側がゲートを起動しないケースでも、
    // このツールでは強制的にイントロ画面を表示する
    gate.classList.add('is-active');
    gate.setAttribute('aria-hidden', 'false');

    function readPosition(el) {
      var parts = getComputedStyle(el).objectPosition.split(' ');
      return {
        x: Math.round(parseFloat(parts[0])) || 0,
        y: Math.round(parseFloat(parts[1])) || 0
      };
    }

    var current = readPosition(foam);

    function render() {
      foam.style.objectPosition = current.x + '% ' + current.y + '%';
    }

    function buildSnippet() {
      return '.intro-scene__foam {\n  object-position: ' + current.x + '% ' + current.y + '%;\n}';
    }

    // ---------- パネルUI ----------
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:99999;width:240px;' +
      'background:rgba(20,30,40,0.88);color:#fff;font:12px/1.5 sans-serif;' +
      'padding:12px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';

    panel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:6px;">白波の位置調整（開発用）</div>' +
      '<div style="color:#cbd5df;margin-bottom:6px;">intro-wave-foam.pngだけを動かします</div>' +
      '<label style="display:block;margin-top:6px;">横位置（X）<span id="pd-x-val"></span></label>' +
      '<input id="pd-x" type="range" min="-500" max="500" step="1" style="width:100%;">' +
      '<label style="display:block;margin-top:6px;">縦位置（Y）<span id="pd-y-val"></span></label>' +
      '<input id="pd-y" type="range" min="-500" max="500" step="1" style="width:100%;">' +
      (bottle ? '<label style="display:block;margin-top:8px;">' +
        '<input id="pd-hide-bottle" type="checkbox"> 瓶を隠す（演出を止めて確認）</label>' : '') +
      '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button id="pd-reset" type="button" style="flex:1;">リセット</button>' +
      '<button id="pd-copy" type="button" style="flex:1;">コピー</button>' +
      '</div>' +
      '<div id="pd-status" style="margin-top:4px;min-height:14px;color:#8ee6a8;"></div>' +
      '<textarea id="pd-output" readonly style="width:100%;height:48px;margin-top:6px;' +
      'font:11px/1.4 monospace;box-sizing:border-box;"></textarea>' +
      '<div style="margin-top:6px;color:#cbd5df;">' +
      'スマホ表示の確認は、ブラウザの幅を狭くするか開発者ツールのデバイスモードをお使いください。' +
      '</div>' +
      '<button id="pd-hide-panel" type="button" style="margin-top:6px;width:100%;">パネルを隠す</button>';

    document.body.appendChild(panel);

    var xSlider = panel.querySelector('#pd-x');
    var ySlider = panel.querySelector('#pd-y');
    var xVal = panel.querySelector('#pd-x-val');
    var yVal = panel.querySelector('#pd-y-val');
    var hideBottleCheckbox = panel.querySelector('#pd-hide-bottle');
    var resetBtn = panel.querySelector('#pd-reset');
    var copyBtn = panel.querySelector('#pd-copy');
    var statusEl = panel.querySelector('#pd-status');
    var outputEl = panel.querySelector('#pd-output');
    var hidePanelBtn = panel.querySelector('#pd-hide-panel');

    function syncFromState() {
      xSlider.value = current.x;
      ySlider.value = current.y;
      xVal.textContent = '：' + current.x + '%';
      yVal.textContent = '：' + current.y + '%';
      outputEl.value = buildSnippet();
    }

    xSlider.addEventListener('input', function () {
      current.x = +xSlider.value;
      render();
      syncFromState();
    });
    ySlider.addEventListener('input', function () {
      current.y = +ySlider.value;
      render();
      syncFromState();
    });

    if (hideBottleCheckbox && bottle) {
      hideBottleCheckbox.addEventListener('change', function () {
        bottle.style.visibility = hideBottleCheckbox.checked ? 'hidden' : '';
      });
    }

    resetBtn.addEventListener('click', function () {
      foam.style.removeProperty('object-position');
      current = readPosition(foam);
      syncFromState();
      statusEl.textContent = '';
    });

    copyBtn.addEventListener('click', function () {
      var text = buildSnippet();
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
    });

    hidePanelBtn.addEventListener('click', function () {
      panel.style.display = 'none';
    });

    render();
    syncFromState();
  }
})();
