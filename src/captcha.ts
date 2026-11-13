// Enhanced CAPTCHA autofill with partial fill support and visual feedback
// Set once this content script has started on a page, so a second injection does nothing.
declare var __vtopCaptcha: boolean | undefined;

(() => {
  'use strict';

  // === ENHANCEMENT: Flexible acceptance with confidence levels ===
  function accept(result: VtopCaptchaReading | null | undefined, max = 10) {
    if (!result || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(result.text) || max < 6 ||
        !Array.isArray(result.scores) || result.scores.length !== 6 ||
        !Array.isArray(result.margins) || result.margins.length !== 6 ||
        !result.scores.every(value => Number.isFinite(value) && value >= .5 && value <= 1) ||
        !result.margins.every(value => Number.isFinite(value) && value >= .15 && value <= 1) ||
        !Number.isFinite(result.meanScore) || result.meanScore < .8) return '';
    return result.text;
  }

  // === ENHANCEMENT: Accept partial results for high-confidence characters ===
  function acceptPartial(result: VtopCaptchaReading | null | undefined, max = 10): { text: string; mask: boolean[] } {
    if (!result || max < 6 ||
        !Array.isArray(result.scores) || result.scores.length !== 6 ||
        !Array.isArray(result.margins) || result.margins.length !== 6) {
      return { text: '', mask: [false, false, false, false, false, false] };
    }

    let text = '';
    const mask: boolean[] = [];

    for (let i = 0; i < 6; i++) {
      const char = result.text[i];
      const score = result.scores[i];
      const margin = result.margins[i];

      // High confidence: score > 0.85 and margin > 0.4
      if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/.test(char) &&
          Number.isFinite(score) && score >= 0.85 &&
          Number.isFinite(margin) && margin >= 0.4) {
        text += char;
        mask[i] = true;
      } else {
        text += '_'; // Placeholder for uncertain character
        mask[i] = false;
      }
    }

    // Only return partial result if at least 3 characters are confident
    const confidentCount = mask.filter(m => m).length;
    if (confidentCount >= 3) {
      return { text, mask };
    }

    return { text: '', mask: [false, false, false, false, false, false] };
  }

  function discover(doc: Document) {
    for (const form of doc.querySelectorAll('form')) {
      if (!form.querySelector('input[type="password"],input#password,input[name="password"]')) continue;
      const input = [...form.querySelectorAll('input')].find(el =>
        /^(text|search|tel)$/i.test(el.type) && /captcha/i.test(`${el.id} ${el.name} ${el.placeholder}`) &&
        !/recaptcha/i.test(`${el.id} ${el.name}`) && !el.disabled && !el.hidden);
      const image = form.querySelector<HTMLImageElement>('#captchaBlock img') || [...form.querySelectorAll('img')].find(el => /captcha/i.test(`${el.id} ${el.getAttribute('src')} ${el.alt}`));
      if (input && image) return { input, image };
    }
    return null;
  }

  if (typeof module === 'object' && module.exports) { module.exports = { accept, acceptPartial, discover }; return; }
  if (globalThis.__vtopCaptcha) return;
  globalThis.__vtopCaptcha = true;

  type Pair = NonNullable<ReturnType<typeof discover>>;
  interface State extends Pair {
    revision: number;
    tried: number;
    owned: string;
    edited: boolean;
    writing?: boolean;
    source?: string;
    partialFilled?: boolean;
    confidenceMask?: boolean[];
    attemptCount?: number;
  }

  let enabled = true, ready = false, current: State | null = null, sequence = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const states = new WeakMap<HTMLInputElement, State>();

  // === ENHANCEMENT: Visual feedback for confidence levels ===
  function addVisualFeedback(input: HTMLInputElement, mask: boolean[]) {
    // Remove any existing feedback
    removeVisualFeedback(input);

    // Create confidence indicator container
    const indicator = document.createElement('div');
    indicator.className = 'vtop-captcha-confidence-indicator';
    indicator.style.cssText = `
      position: absolute;
      display: flex;
      gap: 2px;
      margin-top: 2px;
      font-size: 10px;
      pointer-events: none;
      z-index: 1000;
    `;

    // Add confidence dots for each character
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('span');
      dot.style.cssText = `
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: ${mask[i] ? '#4caf50' : '#ff9800'};
        border: 1px solid ${mask[i] ? '#2e7d32' : '#f57c00'};
      `;
      dot.title = mask[i] ? 'High confidence' : 'Low confidence - please verify';
      indicator.appendChild(dot);
    }

    // Position indicator below input
    const parent = input.parentElement;
    if (parent) {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.className = 'vtop-captcha-wrapper';

      parent.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      wrapper.appendChild(indicator);
    }
  }

  function removeVisualFeedback(input: HTMLInputElement) {
    const wrapper = input.closest('.vtop-captcha-wrapper');
    if (wrapper) {
      const indicator = wrapper.querySelector('.vtop-captcha-confidence-indicator');
      if (indicator) indicator.remove();
    }
  }

  function install(pair: Pair) {
    let state = states.get(pair.input);
    if (state && state.image === pair.image) return state;
    state = {
      ...pair,
      revision: 0,
      tried: -1,
      owned: '',
      edited: !!pair.input.value,
      partialFilled: false,
      attemptCount: 0
    };
    pair.input.addEventListener('input', event => {
      if (!event.isTrusted && state.writing) return;
      state.edited = true;
      state.owned = '';
      sequence++;
      removeVisualFeedback(pair.input);
    });
    pair.image.addEventListener('load', () => {
      state.revision++;
      state.attemptCount = 0;
      sequence++;
      schedule();
    });
    pair.image.addEventListener('error', () => {
      state.revision++;
      state.attemptCount = 0;
      sequence++;
      schedule();
    });
    states.set(pair.input, state);
    return state;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(scan, 100);
  }

  async function scan() {
    if (!ready) return;
    const pair = discover(document);
    if (!pair) {
      if (current) {
        sequence++;
        current = null;
      }
      return;
    }

    const state = install(pair);
    if (current !== state) {
      sequence++;
      current = state;
    }

    if (!enabled) return;
    if (!pair.input.getClientRects().length || !pair.image.getClientRects().length ||
        !pair.image.complete || !pair.image.naturalWidth) return;

    const source = pair.image.currentSrc || pair.image.src;
    if (state.source !== source) {
      state.source = source;
      state.revision++;
      state.attemptCount = 0;
      sequence++;
    }

    if (state.tried === state.revision) return;
    state.tried = state.revision;

    if (state.owned && pair.input.value === state.owned) {
      pair.input.value = '';
      state.owned = '';
    }

    if (state.edited || pair.input.value) return;

    // Limit retry attempts
    if ((state.attemptCount || 0) >= 3) return;
    state.attemptCount = (state.attemptCount || 0) + 1;

    const generation = ++sequence;

    try {
      // Copy the displayed pixels. Never re-fetch a challenge: its endpoint may rotate the server-side answer.
      const width = pair.image.naturalWidth, height = pair.image.naturalHeight;
      if (width * height > 1000000) throw Error('Image too large');
      if (Math.abs(width / height - 5) > .05) throw Error('Unsupported CAPTCHA format');

      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 40;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(pair.image, 0, 0, 200, 40);

      // === ENHANCEMENT: Use ensemble prediction ===
      const imageData = context.getImageData(0, 0, 200, 40).data;
      let response: VtopCaptchaReading | null = null;

      // Try enhanced solver first if available
      if (typeof VtopCaptchaSolver.predictWithEnsemble === 'function') {
        try {
          const model = await (VtopCaptchaSolver as any).modelPromise ||
                        await fetch(chrome.runtime.getURL('captcha-model.json')).then(r => r.json());
          response = VtopCaptchaSolver.predictWithEnsemble(imageData, model);
        } catch (e) {
          // Fall back to standard read
        }
      }

      if (!response) {
        response = await VtopCaptchaSolver.read(imageData);
      }

      if (generation !== sequence || current !== state || !pair.input.isConnected || !pair.image.isConnected ||
          state.edited || pair.input.value || !enabled) return;

      // === ENHANCEMENT: Try full acceptance first, then partial ===
      const fullText = accept(response, pair.input.maxLength > 0 ? pair.input.maxLength : 10);

      if (fullText) {
        // Full confidence - fill everything
        state.owned = fullText;
        state.writing = true;
        state.partialFilled = false;
        try {
          pair.input.value = fullText;
          pair.input.dispatchEvent(new Event('input', { bubbles: true }));
          pair.input.dispatchEvent(new Event('change', { bubbles: true }));
          removeVisualFeedback(pair.input);
        } finally {
          state.writing = false;
        }
      } else if ((state.attemptCount || 0) >= 2) {
        // After multiple attempts, try partial fill
        const partial = acceptPartial(response, pair.input.maxLength > 0 ? pair.input.maxLength : 10);

        if (partial.text && partial.text.includes('_')) {
          // Partial confidence - fill what we know
          state.owned = partial.text;
          state.writing = true;
          state.partialFilled = true;
          state.confidenceMask = partial.mask;

          try {
            // Fill only high-confidence characters
            const displayText = partial.text.split('').map(c => c === '_' ? '' : c).join('');
            pair.input.value = displayText;
            pair.input.dispatchEvent(new Event('input', { bubbles: true }));
            pair.input.dispatchEvent(new Event('change', { bubbles: true }));

            // Add visual feedback
            addVisualFeedback(pair.input, partial.mask);

            // Focus the input so user can complete it
            pair.input.focus();

            // Set cursor to first uncertain position
            const firstUncertain = partial.mask.indexOf(false);
            if (firstUncertain >= 0) {
              const confidentBefore = partial.mask.slice(0, firstUncertain).filter(m => m).length;
              pair.input.setSelectionRange(confidentBefore, confidentBefore);
            }
          } finally {
            state.writing = false;
          }
        }
      }
    } catch (error) {
      // Leave the field available for manual entry
      console.debug('CAPTCHA recognition failed:', error);
    }
  }

  chrome.storage.local.get({ captchaAutofill: true }).then(value => {
    enabled = value.captchaAutofill !== false;
    ready = true;
    schedule();
  }).catch(() => {
    ready = true;
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.captchaAutofill) {
      enabled = changes.captchaAutofill.newValue !== false;
      sequence++;
      schedule();
    }
  });

  new MutationObserver(records => {
    for (const record of records) {
      if (record.target === current?.image) {
        current.revision++;
        current.attemptCount = 0;
        sequence++;
      }
    }
    schedule();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'type', 'hidden']
  });
})();
