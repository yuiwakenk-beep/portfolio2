// ===================================================
// Yui Portfolio - hero-splash.js (v7)
// 波打ち際から画面左側1/3へ、ほぼ透明・無色のしずく型水滴がバーストで飛び、CTA（.hero__cta）の
// ラインを超えた「できること」4個だけが文字入りの透明ガラス水玉に変化する演出。
// フェイク・ミニ飛沫は無地のまま消え、本物とフェイクは水玉化する瞬間まで見た目のロジックが同じ。
//
// v7修正（見た目の質感と上昇高さのみ。バースト頻度・発生エリア・速度基準はv4/v5のまま）：
// - 色バリエーション（data-hue）を廃止し、--color-sea-light/--color-sea-deepのRGB値をごく薄い
//   透明度で使う、ほぼ透明・無色の水滴感に統一
// - 円形からしずく型・不定形（border-radiusを個体ごとにランダム化）に変更
// - 主要な水玉ごとに1〜2個のミニ飛沫（satellite）を同時発生させる
// - 「できること」4個のサイズを固定76/64pxからランダム（60〜92px、収まらない場合は縮小）に変更
// - 上昇距離を「見出し（#heroHeadlineSvg）の高さあたり」まで延長
//
// 横方向の重なり回避は行わず、CTAとの重なりは「CTA上端のライン（gateTop）を超えるまで
// 水しぶきを表示しない」という縦方向の可視化ゲートで解決する（v5からの継続）。
// 位置・不透明度のアニメーションはWeb Animations API（el.animate()）で直接制御し、
// フェーズ1→フェーズ2の引き継ぎで位置がリセットされないようにする。
// クリック/タップで#skillsへスクロール（scroll-behavior:smoothは css/style.css 側で設定済み）。
// prefers-reduced-motion時・JS不通時は index.html 側の静的フォールバック（.hero-splash-fallback）を
// css/animation.css 側で表示させ、ここでは何もしない（PEフォールバックパターン）。
// ===================================================
(function () {
  'use strict';

  // JSが実行できている時点で、既定のjs-disabledクラスを外す（<html>側のPEフォールバック解除）
  document.documentElement.classList.remove('js-disabled');

  var layer = document.getElementById('heroSplashLayer');
  var hero = document.getElementById('hero');
  // 実際のCTAボタン要素（最初の.hero-cta）。縦方向の「表示し始めるライン」の基準にする
  var ctaEl = document.querySelector('.hero-cta');

  function isDesktop() {
    return window.matchMedia('(min-width: 768px)').matches;
  }

  // 手書きコピー（#heroPenSvg）はPC/スマホ共通の要素を常に参照する（js/hero.jsが両方の位置を計算するため）。
  // 見出し（#heroHeadlineSvg）はスマホでは非表示のままなので、非表示要素の座標（0扱い）を参照しないよう、
  // スマホではスマホ専用の見出しブロック（.hero__intro-mobile）側を参照する
  var penEl = document.getElementById('heroPenSvg'); // 手書きコピー。無ければ縦方向の上限チェックはスキップする
  var headlineEl = isDesktop() ? document.getElementById('heroHeadlineSvg') : document.querySelector('.hero__intro-mobile .hero__title'); // 見出し。上昇距離の目標地点として使う
  if (!layer || !hero || !ctaEl) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // 静的フォールバックはCSS側（@media prefers-reduced-motion）が表示する

  if (!('animate' in Element.prototype)) return; // Web Animations API不通時はフォールバック表示に任せる

  var SERVICES = [
    { label: 'HP制作', target: '#skills' },
    { label: 'LP制作', target: '#skills' },
    { label: 'デザイン', target: '#skills' },
    { label: '実装', target: '#skills' }
  ];

  var RISE_SPEED_PX_PER_SEC = 110 / 1.5; // 上昇速度の基準（さらにゆっくりに調整）
  var REVEAL_HOLD_MS = 2000; // 水玉状態で留まる時間（文字を読ませる間をさらに長く）
  var MAX_CONCURRENT = 60; // 同時存在数の上限（滞在時間が伸びたぶん引き上げ）
  var FAKE_STAGGER_MS = 2800; // フェイクを時間差で出すためにばらつかせる幅(ms)。次のバーストが来るまでの間に収める
  var REVEAL_MIDDLE_FRACTION = 0.5; // 文字入り水玉が出現する目安の高さ（#hero高さに対する割合。0=上端、1=下端）
  var REVEAL_SCATTER_FRACTION = 0.32; // 出現高さのばらつき幅（#hero高さに対する割合。4つが同じラインに揃わないようにする）
  var EDGE_MARGIN = 10; // 左端からの最小マージン(px)
  var CTA_MARGIN = 20; // CTA上端から「表示し始めるライン」までのマージン(px)
  var MIN_RISE_PX = 80; // 非表示区間（波打ち際→表示ライン）の最低距離(px)
  // 最長ラベル「デザイン」は12pxフォントで実測48px幅。padding(6px×2)+誤差余裕を足すと
  // 68px未満では文字が1行に収まりきらない（フォントサイズは変更しない前提のため、
  // サイズ側の下限をラベル文字幅より確実に大きく保つ）
  var REVEALED_SIZE_MIN = 86; // 「できること」水玉のサイズ下限(px)（文字を見やすくするため引き上げ）
  var REVEALED_SIZE_MAX = 116; // 「できること」水玉のサイズ上限(px)（同上）
  var MIN_REVEALED_SIZE_PX = 70; // 手書きコピーとの間隔確保のため縮める場合でも、これより小さくしない（文字が1行に収まる最小値）
  var PEN_GAP = 8; // 手書きコピー（#heroPenSvg）との間に空ける最小マージン(px)
  var HEADLINE_MARGIN = 28; // 見出し（#heroHeadlineSvg）と重ならないよう手前で止める余白(px)
  var MIN_VISIBLE_RISE_PX = 24; // topLimitまでの安全な距離がほぼ無い場合でも、最低限これだけは上昇させる
  var LEFT_RANGE_MAX_PCT = 33; // 横方向の発生範囲（#hero幅に対する%）

  // ---------- モバイルは4つの文字あり水玉が重ならないよう固定スロットに配置 ----------
  var MOBILE_REVEAL_SLOTS = [
    { xFrac: 0.08, yFrac: 0.10 },
    { xFrac: 0.56, yFrac: 0.04 },
    { xFrac: 0.04, yFrac: 0.58 },
    { xFrac: 0.58, yFrac: 0.54 }
  ];
  var MOBILE_REVEALED_SIZE = 80; // 重なり防止のためモバイルは固定サイズにする（デスクトップはランダム86〜116のまま）

  function pickMobileSlot(heroRect, bounds, index) {
    var slot = MOBILE_REVEAL_SLOTS[index % MOBILE_REVEAL_SLOTS.length];
    var size = MOBILE_REVEALED_SIZE;
    var widthSpan = Math.max(heroRect.width - EDGE_MARGIN * 2 - size, 40);
    var heightSpan = Math.max(bounds.gateTop - bounds.upperBound - size, 40);
    var left = EDGE_MARGIN + widthSpan * slot.xFrac;
    var top = bounds.upperBound + heightSpan * slot.yFrac;
    return { targetTop: top, size: size, left: left };
  }

  var running = false;
  var timerId = null;

  // 見出し（#heroHeadlineSvg）・手書きコピー（#heroPenSvg）のうち下端が低い方を基準に、
  // そのさらに下（CTA側）に余白を足したラインを「これ以上は上げない上限」として返す(px, #hero起点)。
  // このラインより上には水しぶきを一切表示させない（＝見出し・手書きコピーの視認性を妨げない）
  function computeTopLimit(heroRect) {
    var textBottoms = [];
    if (headlineEl) textBottoms.push(headlineEl.getBoundingClientRect().bottom - heroRect.top);
    if (penEl) textBottoms.push(penEl.getBoundingClientRect().bottom - heroRect.top);
    if (!textBottoms.length) return 0;
    return Math.max.apply(null, textBottoms) + HEADLINE_MARGIN;
  }

  // 水しぶきが「見え始めるライン(gateTop)」と「これより上には出さない上限(upperBound)」を返す。
  // gateTopはCTA上端から少し余裕を持たせた線で、水しぶきはこれより下にいる間は非表示
  // （＝CTAの裏を通っても見た目上は重ならない）。upperBoundは手書きコピー（#heroPenSvg）の下端が基準
  function computeRevealBounds(heroRect, ctaRect) {
    var ctaTopLocal = ctaRect.top - heroRect.top;
    var gateTop = ctaTopLocal - CTA_MARGIN;
    var upperBound = 0;
    if (penEl) {
      var penRect = penEl.getBoundingClientRect();
      upperBound = penRect.bottom - heroRect.top + PEN_GAP;
    }
    return { gateTop: gateTop, upperBound: upperBound };
  }

  // 「できること」水玉1個ぶんの、水玉化する目標位置(targetTop)とサイズ(px)を決める。
  // 4つが同じ高さに揃わないよう、#hero高さのだいたい中央（REVEAL_MIDDLE_FRACTION）を狙いつつ、
  // 個体ごとにREVEAL_SCATTER_FRACTIONぶんランダムに上下させて散らす。
  // gateTop（CTAより上）〜upperBound（手書きコピーより下）の範囲に収まらない場合は、
  // その範囲内に収め、必要ならタップ領域の下限(44px)までサイズを縮める
  function pickRevealTarget(heroRect, bounds) {
    var desiredSize = REVEALED_SIZE_MIN + Math.random() * (REVEALED_SIZE_MAX - REVEALED_SIZE_MIN);
    var middle = heroRect.height * REVEAL_MIDDLE_FRACTION;
    var scatter = heroRect.height * REVEAL_SCATTER_FRACTION;
    var desiredTop = middle + (Math.random() - 0.5) * 2 * scatter;

    var size = desiredSize;
    var maxTop = bounds.gateTop - size; // これより下だとCTAへ重なる
    var minTop = bounds.upperBound; // これより上だと手書きコピーへ重なる
    var targetTop;
    if (maxTop < minTop) {
      // 縦方向にほとんど余裕が無い極端なケース：サイズを最小まで縮めたうえで、
      // 手書きコピーの直下（minTop）に固定する。CTAとの間隔が多少詰まっても、
      // 見出し・手書きコピーの視認性を妨げないことを優先する
      size = MIN_REVEALED_SIZE_PX;
      targetTop = minTop;
    } else {
      targetTop = Math.min(Math.max(desiredTop, minTop), maxTop);
    }
    return { targetTop: targetTop, size: size };
  }

  // 水しぶきの横方向スポーン範囲（px, #hero起点のローカル座標）。
  // CTAとの重なりは縦方向の可視化ゲート（gateTop）で解決するため、横方向は#hero幅の左33%をフルに使う
  function safeXRange() {
    var heroRect = hero.getBoundingClientRect();
    var max = heroRect.width * (LEFT_RANGE_MAX_PCT / 100);
    if (max < EDGE_MARGIN + 60) max = EDGE_MARGIN + 60; // 極端に狭い場合の最低幅を確保
    return { min: EDGE_MARGIN, max: max };
  }

  // バースト内のcount個を、xRangeを等分したレーンにシャッフルして割り当て、
  // レーン内でさらに微小にランダムオフセットする（ジッター付きストラティファイドサンプリング）
  function assignLefts(count, xRange) {
    var span = Math.max(xRange.max - xRange.min, 1);
    var laneWidth = span / count;
    var lanes = [];
    for (var i = 0; i < count; i++) lanes.push(i);
    for (var j = lanes.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = lanes[j];
      lanes[j] = lanes[k];
      lanes[k] = tmp;
    }
    return lanes.map(function (laneIndex) {
      var laneStart = xRange.min + laneIndex * laneWidth;
      var jitter = laneWidth * 0.35 + Math.random() * (laneWidth * 0.3);
      return laneStart + jitter;
    });
  }

  function randomScale() {
    return 0.6 + Math.random() * 0.8; // 0.6〜1.4
  }

  // しずく型・不定形のborder-radius（4隅×2軸をランダムに揺らす）
  function randomBlobRadius() {
    function j(base) {
      var v = base + (Math.random() - 0.5) * 20;
      return Math.max(24, Math.min(76, Math.round(v)));
    }
    return j(46) + '% ' + j(54) + '% ' + j(58) + '% ' + j(42) + '% / ' +
      j(55) + '% ' + j(48) + '% ' + j(52) + '% ' + j(45) + '%';
  }

  // 本物・フェイク・ミニ飛沫とも生成ロジックは完全に共通（水玉化する瞬間まで見分けがつかないようにする）
  function createDrop(service, isSatellite) {
    var el = document.createElement(service ? 'button' : 'div');
    el.className = isSatellite ? 'hero-splash hero-splash--satellite' : 'hero-splash';
    el.style.position = 'absolute';
    el.style.opacity = '0';
    el.style.borderRadius = randomBlobRadius();
    el.setAttribute('aria-hidden', 'true');

    if (service) {
      el.type = 'button';
      el.tabIndex = -1;
      el.dataset.target = service.target;
      var span = document.createElement('span');
      span.className = 'hero-splash__label';
      span.textContent = service.label;
      el.appendChild(span);
    }

    layer.appendChild(el);
    return el;
  }

  // originTop（波打ち際）からgateTop（CTAより上の表示開始ライン）に達するまでは、
  // setTimeoutで“見えないまま”待たせるだけで、DOM上のtop/animationは一切動かさない。
  // gateTopに達した瞬間に初めて位置・アニメーションを設定する＝CTAの裏を通っても重なって見えない
  function startDrop(el, originTop, gateTop, revealTarget, topLimit, leftPx) {
    var isReal = el.tagName === 'BUTTON';
    var scale = randomScale();

    el.style.left = leftPx + 'px';
    el.style.top = originTop + 'px';
    el.style.transform = 'scale(' + scale.toFixed(2) + ')';

    var speedVariance = 0.85 + Math.random() * 0.3;
    var hiddenDist = Math.max(originTop - gateTop, MIN_RISE_PX);
    var hiddenDelay = (hiddenDist / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000;
    var peakOpacity = 0.8 + Math.random() * 0.2; // 0.8〜1.0

    setTimeout(function () {
      el.style.top = gateTop + 'px';

      if (!isReal) {
        // フェイク：見出し・手書きコピーの手前（topLimit）までしか上げない。
        // ease-outは前半で一気に距離を稼ぐため、不透明度もオフセット0.6までに0へ落としきっておき、
        // 「位置はtopLimit付近まで到達しているが見た目はもう消えている」状態を作って重なりを防ぐ
        var fullDistance = Math.max(gateTop - topLimit, MIN_VISIBLE_RISE_PX);
        var dist = fullDistance * (0.55 + Math.random() * 0.3); // 0.55〜0.85（topLimitを超えない）
        var duration = (dist / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000;
        var fakeAnim = el.animate(
          [
            { top: gateTop + 'px', opacity: 0, offset: 0 },
            { opacity: peakOpacity, offset: 0.15 },
            { opacity: 0, offset: 0.6 },
            { top: (gateTop - dist) + 'px', opacity: 0, offset: 1 }
          ],
          { duration: duration, easing: 'ease-out' }
        );
        fakeAnim.onfinish = function () { el.remove(); };
        return;
      }

      var targetTop = revealTarget.targetTop;
      var distReal = Math.max(gateTop - targetTop, 20);
      var durationReal = (distReal / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000;
      var phase1 = el.animate(
        [
          { top: gateTop + 'px', opacity: 0 },
          { opacity: Math.max(peakOpacity, 0.9), offset: 0.3 },
          { top: targetTop + 'px', opacity: 0.95 }
        ],
        { duration: durationReal, easing: 'ease-out' }
      );

      phase1.onfinish = function () {
        // フェーズ1のWAAPIエフェクトを解除し、位置をインラインstyleに確定させてからフェーズ2へ引き継ぐ
        el.style.top = targetTop + 'px';
        el.style.opacity = '0.95';
        revealDrop(el, revealTarget.size, targetTop, topLimit);
      };
    }, hiddenDelay);
  }

  function revealDrop(el, revealedSize, targetTop, topLimit) {
    el.classList.add('is-revealed');
    el.style.borderRadius = randomBlobRadius();
    el.removeAttribute('aria-hidden');
    el.tabIndex = 0;
    var label = el.querySelector('.hero-splash__label');
    el.setAttribute('aria-label', 'できること：' + (label ? label.textContent : '') + '。クリックすると詳細セクションへ移動します');
    el.style.transform = 'scale(1)'; // 生成時のランダムscaleを解除し、幅/高さのtransitionと揃える
    el.style.opacity = '1';
    el.style.width = revealedSize + 'px';
    el.style.height = revealedSize + 'px';

    el.addEventListener('click', function () {
      var target = document.querySelector(el.dataset.target);
      if (target) target.scrollIntoView({ block: 'start' });
    });

    setTimeout(function () {
      var speedVariance = 0.85 + Math.random() * 0.3;
      // 水玉化後、見出し・手書きコピーの手前（topLimit）を意識してさらに上昇してからフェードアウトする
      var remaining = Math.max(targetTop - topLimit, MIN_VISIBLE_RISE_PX);
      var risePx = remaining * (0.35 + Math.random() * 0.3); // 0.35〜0.65（topLimitを超えない）
      var phase2Duration = Math.max((risePx / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000, 500);
      var phase2 = el.animate(
        [
          { transform: 'translateY(0) scale(1)', opacity: 1 },
          { transform: 'translateY(-' + risePx + 'px) scale(0.9)', opacity: 0 }
        ],
        { duration: phase2Duration, easing: 'ease-in' }
      );
      phase2.onfinish = function () { el.remove(); };
    }, REVEAL_HOLD_MS);
  }

  // 主要な水玉(mainLeftPx)のごく近くに、ミニ飛沫を同時発生させる（同時に出すぎないよう基本1個、まれに2個）。
  // ミニ飛沫は常にラベル無し・装飾のみで、本体より一回り小さく・少し早く消える
  function spawnSatellites(mainLeftPx, originTop, gateTop, topLimit) {
    var count = Math.random() < 0.8 ? 1 : 2;
    for (var i = 0; i < count; i++) {
      var el = createDrop(null, true);
      var offset = (Math.random() - 0.5) * 30; // メインドロップの左右±15px程度
      var leftPx = Math.max(0, mainLeftPx + offset);
      var scale = 0.35 + Math.random() * 0.35; // メインより小さい

      el.style.left = leftPx + 'px';
      el.style.top = originTop + 'px';
      el.style.transform = 'scale(' + scale.toFixed(2) + ')';

      var speedVariance = 0.9 + Math.random() * 0.4;
      var hiddenDist = Math.max(originTop - gateTop, MIN_RISE_PX);
      var hiddenDelay = (hiddenDist / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000;

      (function (el, gateTop, topLimit, speedVariance, hiddenDelay) {
        setTimeout(function () {
          el.style.top = gateTop + 'px';
          // メインの上昇距離・表示時間の6〜8割程度で、少し早く消える。
          // ease-outは前半で一気に距離を稼ぐため、不透明度もオフセット0.55までに0へ落としきっておく
          var fullDistance = Math.max(gateTop - topLimit, MIN_VISIBLE_RISE_PX);
          var dist = fullDistance * (0.5 + Math.random() * 0.2); // topLimitを超えない
          var duration = (dist / (RISE_SPEED_PX_PER_SEC * speedVariance)) * 1000;
          var anim = el.animate(
            [
              { top: gateTop + 'px', opacity: 0, offset: 0 },
              { opacity: 0.6 + Math.random() * 0.3, offset: 0.2 },
              { opacity: 0, offset: 0.55 },
              { top: (gateTop - dist) + 'px', opacity: 0, offset: 1 }
            ],
            { duration: duration, easing: 'ease-out' }
          );
          anim.onfinish = function () { el.remove(); };
        }, hiddenDelay);
      })(el, gateTop, topLimit, speedVariance, hiddenDelay);
    }
  }

  function spawnBurst() {
    if (layer.children.length >= MAX_CONCURRENT) return;

    var desktop = isDesktop();
    var heroRect = hero.getBoundingClientRect();
    var ctaRect = ctaEl.getBoundingClientRect();
    var originTop = heroRect.height - (10 + Math.random() * 20); // 波打ち際付近、僅かにばらつかせる
    var bounds = computeRevealBounds(heroRect, ctaRect);
    var topLimit = computeTopLimit(heroRect);
    var xRange = safeXRange();

    // 文字入り（できること）4つは同時に4つを超えて表示しない。前のバッチ（<button>要素）が
    // 1つでも画面に残っている間（上昇中・表示中・フェードアウト中を問わず）は、今回のバーストでは
    // 文字入りを追加しない。フェイク・ミニ飛沫は引き続き通常通り出す
    var canSpawnReal = layer.querySelectorAll('button.hero-splash').length === 0;
    var drops = canSpawnReal ? SERVICES.map(function (s) { return createDrop(s, false); }) : [];

    var fakeCount = 1 + Math.floor(Math.random() * 2); // 1 or 2（従来の2〜3からさらに半分程度に削減）
    if (!desktop) fakeCount = Math.random() < 0.5 ? 0 : 1; // モバイルは0〜1個に抑える
    for (var i = 0; i < fakeCount; i++) drops.push(createDrop(null, false));

    var lefts = assignLefts(drops.length, xRange);
    var useMobileSlots = !desktop && canSpawnReal;

    drops.forEach(function (el, i) {
      var leftPx = lefts[i];
      var isReal = el.tagName === 'BUTTON';
      var delay = isReal ? Math.random() * 150 : Math.random() * FAKE_STAGGER_MS;
      // 「できること」4つの水玉化する目標の高さ・左右位置・サイズを決める。
      // モバイルは重なり防止のため固定スロット（MOBILE_REVEAL_SLOTS）を使い、
      // PCは従来通りランダムな位置・サイズのまま
      var revealTarget = null;
      if (isReal && useMobileSlots) {
        var slotTarget = pickMobileSlot(heroRect, bounds, i);
        leftPx = slotTarget.left;
        revealTarget = { targetTop: slotTarget.targetTop, size: slotTarget.size };
      } else if (isReal) {
        revealTarget = pickRevealTarget(heroRect, bounds);
      }
      setTimeout(function () {
        startDrop(el, originTop, bounds.gateTop, revealTarget, topLimit, leftPx);
        spawnSatellites(leftPx, originTop, bounds.gateTop, topLimit);
      }, delay);
    });
  }

  function loop() {
    if (!running) return;
    spawnBurst();
    timerId = setTimeout(loop, 3200 + Math.random() * 1000); // 3.2〜4.2秒おき（変更なし）
  }

  function start() {
    if (running) return;
    running = true;
    loop();
  }

  function stop() {
    running = false;
    clearTimeout(timerId);
  }

  // 表示中の水しぶきを全て即座に取り除く。タブが非表示の間はCSS/Web Animationsの進行が
  // ブラウザ側で止まる（＝要素が消えるはずのanimationendが発火しない）一方、setTimeoutによる
  // バースト生成自体は止まらずに続くため、非表示のまま放置すると水しぶきが際限なく溜まり、
  // 再びタブを表示した瞬間にどっと出現する不具合が起きる。タブが再表示されたタイミングで
  // 一旦リセットすることでこれを防ぐ
  function clearAll() {
    while (layer.firstChild) layer.removeChild(layer.firstChild);
  }

  // 生成ループを動かしてよいかどうかは「#heroが画面内にあるか」「タブ自体が表示されているか」
  // 「イントロが終わっているか」の3つがそろって初めて真になる。どれか一つでも欠けたら止める。
  // introReadyが無いと、イントロ表示中に裏でバーストが進んでしまい、本編が見えた瞬間には
  // 演出が唐突に始まって（or 既に進行中に）見えるため
  var heroInView = false;
  var tabVisible = !document.hidden;
  var introReady = false;

  function updateRunning() {
    if (heroInView && tabVisible && introReady) start();
    else stop();
  }

  var START_DELAY_AFTER_INTRO = 150; // 本編が見えてから水しぶきを始めるまでの間（ms）
  function onIntroReady() {
    setTimeout(function () {
      introReady = true;
      updateRunning();
    }, START_DELAY_AFTER_INTRO);
  }
  // 訪問済みの場合、js/intro.js側は読み込み直後に同期的に'intro:ready'を発火する。
  // このスクリプトはjs/intro.jsより後に読み込まれるため、addEventListenerする前に発火済みで
  // 聞き逃すことがある（実際に、初回訪問では動くがリロード時だけ水しぶきが出ない不具合として発生した）。
  // まずすでに発火済みかどうかをwindow.__introReadyで確認する
  if (window.__introReady) {
    onIntroReady();
  } else {
    document.addEventListener('intro:ready', onIntroReady, { once: true });
  }

  document.addEventListener('visibilitychange', function () {
    var becameVisible = document.hidden === false && tabVisible === false;
    tabVisible = !document.hidden;
    if (becameVisible) clearAll(); // 非表示の間に溜まった水しぶきを一掃してから再開する
    updateRunning();
  });

  // #heroが画面外にスクロールしたらバースト生成を止め、無駄なCPU/バッテリー消費を避ける
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          heroInView = entry.isIntersecting;
          updateRunning();
        });
      },
      { threshold: 0.1 }
    );
    io.observe(hero);
  } else {
    heroInView = true; // IntersectionObserver不通時は常時視野内とみなす（従来通り）
    updateRunning();
  }
})();
