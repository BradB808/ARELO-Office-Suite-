/* Anleo Office — site behaviour. No dependencies, no third-party requests. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Typewriter on the CRT ─────────────────────────────── */
  var LINE = 'Documents, spreadsheets, presentations and forms. One Mac app_';
  var typed = document.getElementById('typed');

  if (typed) {
    if (reduced) {
      typed.textContent = LINE;
    } else {
      var cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.textContent = '_';
      var text = document.createTextNode('');
      typed.appendChild(text);
      typed.appendChild(cursor);

      var body = LINE.slice(0, -1); // everything but the trailing underscore
      var i = 0;
      var tick = function () {
        text.nodeValue = body.slice(0, i);
        i++;
        if (i <= body.length) {
          // vary the cadence a little so it reads as typing, not a metronome
          var ch = body.charAt(i - 1);
          var delay = ch === ',' || ch === '.' ? 220 : 26 + Math.random() * 34;
          setTimeout(tick, delay);
        }
      };
      setTimeout(tick, 420);
    }
  }

  /* ── 2. The CRT boots into the real app as you scroll ─────── */
  var shot = document.getElementById('crtShot');
  var mac = document.getElementById('mac');

  if (shot && mac && !reduced) {
    var onScroll = function () {
      var rect = mac.getBoundingClientRect();
      // progress from the moment the Mac starts leaving the top of the screen
      var travel = rect.height * 0.45;
      var p = Math.min(1, Math.max(0, -rect.top / travel));
      shot.style.opacity = p;
      // the headline clears out ahead of the screenshot so the two never muddle
      if (typed) typed.style.opacity = 1 - Math.min(1, p * 2.2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (shot && reduced) {
    shot.style.opacity = 1;
    if (typed) typed.style.opacity = 0;
  }

  /* ── 3. Scroll reveals ────────────────────────────────────── */
  var revealables = document.querySelectorAll('[data-reveal], .chatty li');

  if (!('IntersectionObserver' in window) || reduced) {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(revealables, function (el, n) {
      // stagger siblings inside a grid so cards cascade rather than pop together
      var parent = el.parentElement;
      if (parent && (parent.classList.contains('grid') ||
                     parent.classList.contains('chatty') ||
                     parent.classList.contains('privacy__grid') ||
                     parent.classList.contains('tests'))) {
        var index = Array.prototype.indexOf.call(parent.children, el);
        el.style.transitionDelay = Math.min(index, 5) * 90 + 'ms';
      }
      io.observe(el);
    });
  }

  /* ── 4. Copy buttons on the terminals ─────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll('.term__copy'), function (btn) {
    var idle = btn.textContent;
    var revert;

    var flash = function (label, ok) {
      clearTimeout(revert);
      btn.textContent = label;
      btn.classList.toggle('is-done', !!ok);
      revert = setTimeout(function () {
        btn.textContent = idle;
        btn.classList.remove('is-done');
      }, 2200);
    };

    btn.addEventListener('click', function () {
      var term = btn.closest('.term');
      var payload = term && term.getAttribute('data-copy');
      if (!payload) return;

      var copied = function () { flash('Copied', true); };

      // execCommand still works in a few places the async clipboard refuses
      var legacy = function () {
        var ta = document.createElement('textarea');
        ta.value = payload;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        return ok;
      };

      // last resort: select the command in place so ⌘C still gets it, rather
      // than leaving a button that looks broken
      var selectInPlace = function () {
        try {
          var range = document.createRange();
          range.selectNodeContents(term.querySelector('.term__body'));
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
        flash('Press ⌘C', false);
      };

      var fallback = function () {
        if (legacy()) copied();
        else selectInPlace();
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(copied, fallback);
      } else {
        fallback();
      }
    });
  });

  /* ── 5. Nav hides on the way down, returns on the way up ──── */
  var nav = document.getElementById('nav');
  if (nav) {
    var last = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y > 420 && y > last + 4) nav.classList.add('is-hidden');
      else if (y < last - 4 || y < 420) nav.classList.remove('is-hidden');
      last = y;
    }, { passive: true });
  }
})();
