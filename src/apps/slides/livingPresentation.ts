// "Living presentation" export: one self-contained .html file. Every slide is
// rendered through the exact same pure SlideView renderer used by the editor
// (via react-dom/server, no new dependency) so it is pixel-identical to the
// deck, then wrapped in a small nav/keyboard/touch script. No network, no libs.

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SlidesContent } from '../../shared/types'
import { SLIDE_H, SLIDE_W } from '../../shared/types'
import { jsonForScript, livingPage } from '../../shared/livingDoc'
import { getTheme } from './themes'
import { SlideView } from './SlideView'

export function buildLivingPresentation(content: SlidesContent, title: string): string {
  const theme = getTheme(content.themeId)

  const slidesHtml = content.slides
    .map((s, i) => {
      const inner = renderToStaticMarkup(
        React.createElement(SlideView, {
          slide: s,
          theme,
          scale: 1,
          pageNumber: content.showSlideNumbers && i > 0 ? i + 1 : undefined,
        }),
      )
      return `<section class="lp-slide" data-index="${i}">${inner}</section>`
    })
    .join('\n')

  const notes = content.slides.map((s) => s.notes || '')

  const css = `
    html, body { height: 100%; overflow: hidden; }
    .anleo-wrap { display: none; }
    .lp-stage {
      position: fixed; left: 0; right: 0; bottom: 0; top: 0;
      display: flex; align-items: center; justify-content: center;
      background: #05060a; overflow: hidden; cursor: pointer; user-select: none;
    }
    .lp-frame {
      position: relative; width: ${SLIDE_W}px; height: ${SLIDE_H}px; flex-shrink: 0;
      box-shadow: 0 30px 90px rgba(0,0,0,0.55);
    }
    .lp-slide {
      position: absolute; inset: 0; opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .lp-slide.active { opacity: 1; pointer-events: auto; }
    .lp-slide .px-slideview { position: relative; overflow: hidden; }
    .lp-chip {
      position: fixed; padding: 5px 11px; border-radius: 999px;
      background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85);
      font-size: 12px; font-weight: 600; letter-spacing: 0.02em; z-index: 20;
      pointer-events: none;
    }
    .lp-counter { right: 18px; bottom: 16px; }
    .lp-hint { left: 18px; bottom: 16px; font-weight: 500; color: rgba(255,255,255,0.5); background: none; }
    .lp-notes {
      position: fixed; left: 0; right: 0; bottom: 0; max-height: 26vh; overflow-y: auto;
      background: rgba(10,10,14,0.88); backdrop-filter: blur(6px); color: rgba(255,255,255,0.92);
      padding: 14px 22px 18px; box-sizing: border-box; z-index: 21;
      display: none; font-size: 15px; line-height: 1.5; white-space: pre-wrap;
    }
    .lp-notes.show { display: block; }
    .lp-notes-label {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: rgba(255,255,255,0.5); margin-bottom: 6px;
    }
  `

  const script = `
    (function () {
      var slides = Array.prototype.slice.call(document.querySelectorAll('.lp-slide'));
      var notesData = ${jsonForScript(notes)};
      var idx = 0;
      var notesOn = false;
      var stage = document.getElementById('lp-stage');
      var frame = document.getElementById('lp-frame');
      var counter = document.getElementById('lp-counter');
      var notesEl = document.getElementById('lp-notes');
      var notesBody = document.getElementById('lp-notes-body');
      var bar = document.querySelector('.anleo-bar');

      function render() {
        for (var i = 0; i < slides.length; i++) slides[i].classList.toggle('active', i === idx);
        if (counter) counter.textContent = (idx + 1) + ' / ' + slides.length;
        if (notesBody) notesBody.textContent = notesData[idx] || 'No notes for this slide.';
      }
      function go(delta) {
        var next = Math.min(slides.length - 1, Math.max(0, idx + delta));
        if (next === idx) return;
        idx = next;
        render();
      }
      function fit() {
        var barH = bar ? bar.getBoundingClientRect().height : 0;
        if (stage) stage.style.top = barH + 'px';
        var availW = window.innerWidth;
        var availH = window.innerHeight - barH;
        var scale = Math.min(availW / ${SLIDE_W}, availH / ${SLIDE_H});
        if (frame) frame.style.transform = 'scale(' + scale + ')';
      }

      window.addEventListener('resize', fit);
      fit();
      render();

      document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          go(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          go(-1);
        } else if (e.key.toLowerCase() === 's') {
          notesOn = !notesOn;
          if (notesEl) notesEl.classList.toggle('show', notesOn);
        } else if (e.key.toLowerCase() === 'f') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function () {});
          } else {
            document.exitFullscreen && document.exitFullscreen().catch(function () {});
          }
        }
      });

      if (stage) {
        stage.addEventListener('click', function (e) {
          var rect = stage.getBoundingClientRect();
          go(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
        });
      }

      var touchStartX = null;
      if (stage) {
        stage.addEventListener('touchstart', function (e) {
          touchStartX = e.touches[0].clientX;
        }, { passive: true });
        stage.addEventListener('touchend', function (e) {
          if (touchStartX === null) return;
          var dx = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchStartX = null;
        }, { passive: true });
      }
    })();
  `

  const body = `
<div class="lp-stage" id="lp-stage">
  <div class="lp-frame" id="lp-frame">
${slidesHtml}
  </div>
</div>
<div class="lp-chip lp-counter" id="lp-counter"></div>
<div class="lp-chip lp-hint">&larr; &rarr; navigate &middot; click to advance &middot; S notes &middot; F fullscreen</div>
<div class="lp-notes" id="lp-notes">
  <div class="lp-notes-label">Speaker notes</div>
  <div id="lp-notes-body"></div>
</div>`

  return livingPage({
    title: title || 'Untitled presentation',
    badge: 'Interactive presentation',
    css,
    body,
    script,
  })
}
