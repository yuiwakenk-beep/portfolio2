// ===================================================
// Yui Portfolio - main.js
// ヘッダー切替 / ハンバーガーメニュー / トップへ戻るボタン
// ===================================================
(function () {
  'use strict';

  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');
  const navOverlay = document.getElementById('navOverlay');
  const toTop = document.getElementById('toTop');

  // ---------- スクロールでヘッダーの見た目を切替 ----------
  function onScroll() {
    if (header) {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    }
    if (toTop) {
      toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- ハンバーガーメニュー ----------
  function openMenu() {
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'メニューを閉じる');
    navMobile.classList.add('is-open');
    navOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'メニューを開く');
    navMobile.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (navToggle && navMobile && navOverlay) {
    navToggle.addEventListener('click', function () {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMenu() : openMenu();
    });

    navOverlay.addEventListener('click', closeMenu);

    navMobile.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }
})();
