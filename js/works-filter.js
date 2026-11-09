// ===================================================
// Yui Portfolio - works-filter.js（works.html専用）
// 制作実績のジャンル切り替え（すべて／LP・HP／SNS・広告デザイン）
//
// ・各作品の<article>に付けた data-genre（web / design）で表示・非表示を切り替える
// ・URLに ?genre=design（または web）を付けて開くと、最初からそのジャンルを選んだ状態にする
//   （トップページの「制作のポイントを詳しく見る」から works.html?genre=design#work-06 で来る想定）
// ・JSが動かない環境では、切り替えボタン自体が hidden のまま表示されず、全作品がそのまま並ぶ
// ===================================================
(function () {
  'use strict';

  const filter = document.getElementById('worksFilter');
  const status = document.getElementById('worksFilterStatus');
  const items = document.querySelectorAll('.work-item[data-genre]');
  if (!filter || !items.length) return;

  const buttons = filter.querySelectorAll('[data-filter]');
  const validGenres = ['all', 'web', 'design'];

  // 件数表示用のジャンル名
  const labels = {
    all: 'すべての作品',
    web: 'LP・HPの作品',
    design: 'SNS・広告デザインの作品'
  };

  function apply(genre, updateUrl) {
    if (validGenres.indexOf(genre) === -1) genre = 'all';

    let count = 0;
    items.forEach(function (item) {
      const match = genre === 'all' || item.getAttribute('data-genre') === genre;
      item.hidden = !match;
      if (match) count++;
    });

    buttons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-filter') === genre ? 'true' : 'false');
    });

    // 読み上げソフト向けに、切り替え後の件数を知らせる（画面上は小さく表示）
    if (status) status.textContent = labels[genre] + '（' + count + '件）を表示しています';

    // 再読み込みや共有をしても同じジャンルで開けるよう、URLの ?genre= を書き換える（履歴は増やさない）
    if (updateUrl && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (genre === 'all') {
        url.searchParams.delete('genre');
      } else {
        url.searchParams.set('genre', genre);
      }
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      apply(btn.getAttribute('data-filter'), true);
    });
  });

  // 初期表示：URLの ?genre= を読む
  const params = new URLSearchParams(window.location.search);
  apply(params.get('genre') || 'all', false);
  filter.hidden = false;

  // #work-06 などのアンカー付きで開いたとき、非表示だった作品が表示されて位置がずれるため、
  // 絞り込み後にあらためて目的の作品までスクロールし直す
  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target && !target.hidden) {
      window.requestAnimationFrame(function () {
        target.scrollIntoView();
      });
    }
  }
})();
