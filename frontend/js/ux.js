/**
 * AI 康养旅居 — UX Engine
 * Sprint 6 Phase 4: Brand Experience
 *
 * Includes:
 *   - View Transition API (+ CSS fallback)
 *   - Magnetic Button Interaction
 *   - Page Progress Bar
 *   - Skeleton Loading
 *   - Motion System (unified durations & eases)
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════
  //  Motion System — unified durations & eases
  // ═══════════════════════════════════════════════════════
  var MOTION = {
    fast:     { duration: 200, ease: 'cubic-bezier(0.16,1,0.3,1)' },
    normal:   { duration: 300, ease: 'cubic-bezier(0.16,1,0.3,1)' },
    medium:   { duration: 500, ease: 'cubic-bezier(0.19,1,0.22,1)' },
    slow:     { duration: 800, ease: 'cubic-bezier(0.19,1,0.22,1)' },
    slower:   { duration: 1200, ease: 'cubic-bezier(0.19,1,0.22,1)' },
    spring:   { duration: 500, ease: 'cubic-bezier(0.34,1.56,0.64,1)' },
  };

  // ═══════════════════════════════════════════════════════
  //  Module 1: View Transition
  // ═══════════════════════════════════════════════════════

  function initViewTransitions() {
    // View Transition API detection
    var supportsVT = document.startViewTransition &&
      !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (supportsVT) {
      // Enhanced: shared-element transitions for navigations
      document.documentElement.style.setProperty('--vt-support', '1');
    }

    // CSS fallback: page entrance animation
    // Applied via .page-entrance class on body
    document.body.classList.add('page-entrance');

    // Intercept same-origin navigations for smooth transitions
    if (supportsVT) {
      document.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//')) return;

        e.preventDefault();
        var target = link.href;

        document.startViewTransition(function () {
          return new Promise(function (resolve) {
            window.location.href = target;
            // View Transition will capture the old state before navigation
            setTimeout(resolve, 50);
          });
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Module 3: Magnetic Interaction
  // ═══════════════════════════════════════════════════════

  function initMagneticButtons() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('ontouchstart' in window) && window.matchMedia('(pointer: fine)').matches === false) return;

    var buttons = document.querySelectorAll('.btn-primary, .btn-glass, .nav-cta');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.classList.add('magnetic-btn');
      btn.setAttribute('data-magnetic', '');

      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        var intensity = 3; // px max movement

        btn.style.transform =
          'translate(' + (x * intensity / (rect.width / 2)).toFixed(1) + 'px, ' +
          (y * intensity / (rect.height / 2)).toFixed(1) + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = 'translate(0, 0)';
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Page Progress Bar
  // ═══════════════════════════════════════════════════════

  function initPageProgress() {
    // Create progress bar element
    var bar = document.createElement('div');
    bar.className = 'page-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="page-progress-fill"></div>';
    document.body.prepend(bar);

    var fill = bar.querySelector('.page-progress-fill');

    // Scroll-driven progress
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          var progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
          fill.style.transform = 'scaleX(' + progress.toFixed(3) + ')';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════════════
  //  Module 5: Skeleton Loading
  // ═══════════════════════════════════════════════════════

  /**
   * Replace element content with skeleton placeholder
   */
  function showSkeleton(container, type) {
    if (!container) return;
    type = type || 'card';

    var skeletonHtml = '';
    switch (type) {
      case 'card':
        skeletonHtml = '<div class="skeleton-card">' +
          '<div class="skeleton-box skeleton-img"></div>' +
          '<div class="skeleton-card-body">' +
          '<div class="skeleton-line skeleton-line-title"></div>' +
          '<div class="skeleton-line skeleton-line-sub"></div>' +
          '<div class="skeleton-line skeleton-line-short"></div>' +
          '</div></div>';
        break;
      case 'tile':
        skeletonHtml = '<div class="skeleton-tile">' +
          '<div class="skeleton-circle"></div>' +
          '<div class="skeleton-line skeleton-line-title" style="margin:8px auto 0;width:60%;"></div>' +
          '<div class="skeleton-line skeleton-line-sub" style="margin:4px auto 0;width:40%;"></div>' +
          '</div>';
        break;
      case 'text':
        skeletonHtml = '<div class="skeleton-line skeleton-line-title"></div>' +
          '<div class="skeleton-line" style="width:70%;"></div>' +
          '<div class="skeleton-line skeleton-line-short"></div>';
        break;
    }

    container.setAttribute('data-skeleton', type);
    container.innerHTML = skeletonHtml;
  }

  /**
   * Remove skeleton and restore content
   */
  function hideSkeleton(container) {
    if (!container) return;
    container.removeAttribute('data-skeleton');
  }

  // ═══════════════════════════════════════════════════════
  //  Focus Ring & Keyboard Navigation
  // ═══════════════════════════════════════════════════════

  function initAccessibility() {
    // Focus ring is handled by :focus-visible in reset.css
    // Ensure all interactive elements are keyboard-accessible
    document.querySelectorAll('[role="button"], .btn, .nav-link, .showcase-card').forEach(function (el) {
      if (!el.hasAttribute('tabindex') && el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        el.setAttribute('tabindex', '0');
      }
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON' && !el.hasAttribute('role')) {
        el.setAttribute('role', 'button');
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Image Blur-Up Loading
  // ═══════════════════════════════════════════════════════

  function initBlurUpImages() {
    document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
      img.classList.add('blur-up');

      if (img.complete) {
        img.classList.add('blur-up-loaded');
      } else {
        img.addEventListener('load', function () {
          img.classList.add('blur-up-loaded');
        });
        img.addEventListener('error', function () {
          img.classList.add('blur-up-loaded'); // show fallback without blur
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Init
  // ═══════════════════════════════════════════════════════

  function init() {
    initPageProgress();
    initViewTransitions();
    initMagneticButtons();
    initAccessibility();
    initBlurUpImages();

    // Re-init magnetic when DOM changes (for dynamic content)
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () {
        initMagneticButtons();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Exports ──────────────────────────────────────────
  window.HealthTravelUX = {
    MOTION: MOTION,
    showSkeleton: showSkeleton,
    hideSkeleton: hideSkeleton,
    initMagneticButtons: initMagneticButtons,
  };
})();
