// ===================================================
// Yui Portfolio - intro-position-debug.js
// 【納品物には含めない開発用ツール】
// イントロの白波画像（sozai/intro-wave-foam.png = .intro-scene__foam）の
// - object-position（渚に対する位置）
// - はみ出し量・傾き・上下シフト・揺れ幅（.intro-sceneのCSS変数）
// を画面上のスライダーで調整し、確定した数値をCSS用テキストとしてコピーするためのパネル。
// 背景写真(.intro-scene__bg)・瓶(#introBottle)には一切触れない。
// URLに ?posdebug=1 を付けたときだけ動作し、それ以外（通常閲覧・納品版）では何もしない。
// 実機のスマホ幅で確認したい場合は、ブラウザの表示幅をスマホ幅に狭めてからこのURLで開く
// （767px以下でのみ .intro-scene 側のスマホ用オーバーライドが有効になるため）。
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
    var scene = document.querySelector('.intro-scene');
    var bottle = document.getElementById('introBottle');
    if (!gate || !foam || !scene) return;

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

    // .intro-sceneのCSS変数（現在有効な値＝767px以下ならスマホ用の上書き込みで読む）
    function readVar(name, fallback) {
      var raw = getComputedStyle(scene).getPropertyValue(name).trim();
      var num = parseFloat(raw);
      return isNaN(num) ? fallback : num;
    }

    var current = readPosition(foam);
    // shiftYだけはvh（画面の高さに対する割合）で管理する。object-position（X/Y）はcoverの
    // クロップ計算上、この写真では縦方向にほぼ「はみ出し余地」が無く動かしても見た目が変わらないため、
    // 画面中央あたりまで大きく動かしたい場合はtransformで直接動かすshiftYを使う
    var v = {
      overscan: readVar('--foam-overscan', 1.16),
      tilt: readVar('--foam-tilt', -3),
      shiftY: pxToVh(readVar('--foam-shift-y', -12)),
      driftX: readVar('--foam-drift-x', 0.6),
      bobY: readVar('--foam-bob-y', 2)
    };

    function pxToVh(px) {
      return Math.round((px / window.innerHeight) * 1000) / 10;
    }

    function render() {
      foam.style.objectPosition = current.x + '% ' + current.y + '%';
      scene.style.setProperty('--foam-overscan', v.overscan);
      scene.style.setProperty('--foam-tilt', v.tilt + 'deg');
      scene.style.setProperty('--foam-shift-y', v.shiftY + 'vh');
      scene.style.setProperty('--foam-drift-x', v.driftX + '%');
      scene.style.setProperty('--foam-bob-y', v.bobY + 'px');
    }

    function buildSnippet() {
      return '.intro-scene__foam {\n  object-position: ' + current.x + '% ' + current.y + '%;\n}\n\n' +
        '.intro-scene {\n' +
        '  --foam-overscan: ' + v.overscan + ';\n' +
        '  --foam-tilt: ' + v.tilt + 'deg;\n' +
        '  --foam-shift-y: ' + v.shiftY + 'vh;\n' +
        '  --foam-drift-x: ' + v.driftX + '%;\n' +
        '  --foam-bob-y: ' + v.bobY + 'px;\n' +
        '}';
    }

    // ---------- パネルUI ----------
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:99999;width:260px;' +
      'max-height:calc(100vh - 24px);overflow-y:auto;' +
      'background:rgba(20,30,40,0.88);color:#fff;font:12px/1.5 sans-serif;' +
      'padding:12px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';

    panel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:6px;">白波の位置調整（開発用）</div>' +
      '<div style="color:#cbd5df;margin-bottom:6px;">intro-wave-foam.pngだけを動かします</div>' +
      '<label style="display:block;margin-top:6px;">横位置（X）<span id="pd-x-val"></span></label>' +
      '<input id="pd-x" type="range" min="-500" max="500" step="1" style="width:100%;">' +
      '<label style="display:block;margin-top:6px;">縦位置（Y）<span id="pd-y-val"></span></label>' +
      '<input id="pd-y" type="range" min="-500" max="500" step="1" style="width:100%;">' +
      '<div style="color:#f0c987;font-size:11px;margin-top:4px;">' +
      'この写真は縦方向にクロップの余地がほぼ無く、Yを動かしても見た目が変わりません。' +
      '画面中央あたりまで大きく動かしたい場合は、下の「上下シフト」をお使いください。</div>' +
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:10px 0;">' +
      '<div style="color:#cbd5df;margin-bottom:6px;">はみ出し量・傾き・揺れ（画面端の見切れ対策）</div>' +
      '<label style="display:block;margin-top:6px;">はみ出し量（overscan）<span id="pd-overscan-val"></span></label>' +
      '<input id="pd-overscan" type="range" min="1.00" max="1.80" step="0.01" style="width:100%;">' +
      '<label style="display:block;margin-top:6px;">傾き（tilt, deg）<span id="pd-tilt-val"></span></label>' +
      '<input id="pd-tilt" type="range" min="-10" max="10" step="0.5" style="width:100%;">' +
      '<label style="display:block;margin-top:6px;">上下シフト（shiftY, 画面高さに対する%）<span id="pd-shifty-val"></span></label>' +
      '<input id="pd-shifty" type="range" min="-80" max="70" step="1" style="width:100%;">' +
      '<div style="color:#cbd5df;font-size:11px;margin-top:2px;">白波全体を上下に動かします。値を大きくすると画面下方向、小さく（マイナス方向）すると画面上方向へ動きます（目安：瓶の中央あたりは約-20〜-25）。</div>' +
      '<label style="display:block;margin-top:6px;">左右の揺れ幅（driftX, %）<span id="pd-driftx-val"></span></label>' +
      '<input id="pd-driftx" type="range" min="0" max="3" step="0.1" style="width:100%;">' +
      '<label style="display:block;margin-top:6px;">上下の揺れ幅（bobY, px）<span id="pd-boby-val"></span></label>' +
      '<input id="pd-boby" type="range" min="0" max="8" step="0.5" style="width:100%;">' +
      (bottle ? '<label style="display:block;margin-top:8px;">' +
        '<input id="pd-hide-bottle" type="checkbox"> 瓶を隠す（演出を止めて確認）</label>' : '') +
      '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button id="pd-reset" type="button" style="flex:1;">リセット</button>' +
      '<button id="pd-copy" type="button" style="flex:1;">コピー</button>' +
      '</div>' +
      '<div id="pd-status" style="margin-top:4px;min-height:14px;color:#8ee6a8;"></div>' +
      '<textarea id="pd-output" readonly style="width:100%;height:96px;margin-top:6px;' +
      'font:11px/1.4 monospace;box-sizing:border-box;"></textarea>' +
      '<div style="margin-top:6px;color:#cbd5df;">' +
      'スマホ表示の確認は、ブラウザの表示幅を狭くしてからこのページを開いてください（767px以下でスマホ用の値が使われます）。' +
      '</div>' +
      '<button id="pd-hide-panel" type="button" style="margin-top:6px;width:100%;">パネルを隠す</button>';

    document.body.appendChild(panel);

    var xSlider = panel.querySelector('#pd-x');
    var ySlider = panel.querySelector('#pd-y');
    var xVal = panel.querySelector('#pd-x-val');
    var yVal = panel.querySelector('#pd-y-val');
    var overscanSlider = panel.querySelector('#pd-overscan');
    var tiltSlider = panel.querySelector('#pd-tilt');
    var shiftYSlider = panel.querySelector('#pd-shifty');
    var driftXSlider = panel.querySelector('#pd-driftx');
    var bobYSlider = panel.querySelector('#pd-boby');
    var overscanVal = panel.querySelector('#pd-overscan-val');
    var tiltVal = panel.querySelector('#pd-tilt-val');
    var shiftYVal = panel.querySelector('#pd-shifty-val');
    var driftXVal = panel.querySelector('#pd-driftx-val');
    var bobYVal = panel.querySelector('#pd-boby-val');
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
      overscanSlider.value = v.overscan;
      tiltSlider.value = v.tilt;
      shiftYSlider.value = v.shiftY;
      driftXSlider.value = v.driftX;
      bobYSlider.value = v.bobY;
      overscanVal.textContent = '：' + v.overscan.toFixed(2);
      tiltVal.textContent = '：' + v.tilt + 'deg';
      shiftYVal.textContent = '：' + v.shiftY;
      driftXVal.textContent = '：' + v.driftX.toFixed(1) + '%';
      bobYVal.textContent = '：' + v.bobY.toFixed(1) + 'px';
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
    overscanSlider.addEventListener('input', function () {
      v.overscan = +overscanSlider.value;
      render();
      syncFromState();
    });
    tiltSlider.addEventListener('input', function () {
      v.tilt = +tiltSlider.value;
      render();
      syncFromState();
    });
    shiftYSlider.addEventListener('input', function () {
      v.shiftY = +shiftYSlider.value;
      render();
      syncFromState();
    });
    driftXSlider.addEventListener('input', function () {
      v.driftX = +driftXSlider.value;
      render();
      syncFromState();
    });
    bobYSlider.addEventListener('input', function () {
      v.bobY = +bobYSlider.value;
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
      scene.style.removeProperty('--foam-overscan');
      scene.style.removeProperty('--foam-tilt');
      scene.style.removeProperty('--foam-shift-y');
      scene.style.removeProperty('--foam-drift-x');
      scene.style.removeProperty('--foam-bob-y');
      current = readPosition(foam);
      v = {
        overscan: readVar('--foam-overscan', 1.16),
        tilt: readVar('--foam-tilt', -3),
        shiftY: pxToVh(readVar('--foam-shift-y', -12)),
        driftX: readVar('--foam-drift-x', 0.6),
        bobY: readVar('--foam-bob-y', 2)
      };
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
