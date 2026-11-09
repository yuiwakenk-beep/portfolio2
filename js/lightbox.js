// ===================================================
// Yui Portfolio - lightbox.js
// SNS・広告デザインの画像をクリックで拡大表示する
//
// 使い方（HTML側）：
//   <ul data-lightbox-group="グループ名">
//     <li><button type="button" data-lightbox-src="拡大する画像のパス"><img alt="説明"></button></li>
//   </ul>
//   ・同じグループ内は「前へ／次へ」ボタンと左右キーで切り替えられる
//   ・拡大画像の説明（alt）は、ボタン内の<img>のaltをそのまま使う
//   ・閉じる操作：×ボタン／Escキー／画像の外（背景）をクリック
//
// ブラウザ標準の<dialog>を使うため、フォーカスの閉じ込めとEscキーは
// ブラウザ側が面倒を見てくれる。<dialog>非対応の古いブラウザでは何もしない
// （その場合でも、ページ上の画像はそのまま見られる）
// ===================================================
(function () {
  'use strict';

  const groups = document.querySelectorAll('[data-lightbox-group]');
  if (!groups.length || typeof HTMLDialogElement === 'undefined') return;

  // ---------- 拡大表示用の<dialog>を1つだけ作って使い回す ----------
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', '画像の拡大表示');
  dialog.innerHTML =
    '<figure class="lightbox__figure">' +
      '<img class="lightbox__image" src="" alt="">' +
      '<figcaption class="lightbox__caption"></figcaption>' +
    '</figure>' +
    '<button type="button" class="lightbox__close" aria-label="閉じる">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
    '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="前の画像">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' +
    '</button>' +
    '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="次の画像">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
    '</button>';
  document.body.appendChild(dialog);

  const image = dialog.querySelector('.lightbox__image');
  const caption = dialog.querySelector('.lightbox__caption');
  const closeBtn = dialog.querySelector('.lightbox__close');
  const prevBtn = dialog.querySelector('.lightbox__nav--prev');
  const nextBtn = dialog.querySelector('.lightbox__nav--next');

  let currentItems = []; // 今開いているグループのボタン一覧
  let currentIndex = 0;
  let lastTrigger = null; // 閉じたときにフォーカスを戻すボタン

  // ---------- 指定した番号の画像を表示する ----------
  function show(index) {
    const item = currentItems[index];
    if (!item) return;
    currentIndex = index;

    const thumb = item.querySelector('img');
    const alt = thumb ? thumb.getAttribute('alt') : '';
    image.src = item.getAttribute('data-lightbox-src');
    image.alt = alt;

    // グループ内に複数枚あるときだけ「2 / 5」のような番号と前後ボタンを出す。
    // altの先頭の「2枚目：」は番号と重複するため、キャプションでは省く
    const hasMany = currentItems.length > 1;
    const text = alt.replace(/^\d+枚目：/, '');
    caption.textContent = hasMany ? (index + 1) + ' / ' + currentItems.length + '　' + text : text;
    prevBtn.hidden = !hasMany;
    nextBtn.hidden = !hasMany;
  }

  function step(delta) {
    const total = currentItems.length;
    if (total < 2) return;
    show((currentIndex + delta + total) % total);
  }

  function open(groupEl, item) {
    currentItems = Array.prototype.slice.call(groupEl.querySelectorAll('[data-lightbox-src]'));
    lastTrigger = item;
    show(currentItems.indexOf(item));
    dialog.showModal();
    document.documentElement.classList.add('is-lightbox-open'); // 背景のスクロールを止める
  }

  // ---------- 各グループの画像ボタンにクリックを設定 ----------
  groups.forEach(function (groupEl) {
    groupEl.querySelectorAll('[data-lightbox-src]').forEach(function (item) {
      item.setAttribute('aria-haspopup', 'dialog');
      item.addEventListener('click', function () {
        open(groupEl, item);
      });
    });
  });

  // ---------- 閉じる・切り替える操作 ----------
  closeBtn.addEventListener('click', function () {
    dialog.close();
  });
  prevBtn.addEventListener('click', function () {
    step(-1);
  });
  nextBtn.addEventListener('click', function () {
    step(1);
  });

  // 画像の外（dialog自身＝背景部分）をクリックしたら閉じる
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  // 左右キーで前後の画像へ（Escキーはdialogが標準で閉じてくれる）
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // 閉じたあと：スクロールを戻し、開く前に押したボタンへフォーカスを戻す
  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('is-lightbox-open');
    image.src = '';
    if (lastTrigger) lastTrigger.focus();
  });
})();
