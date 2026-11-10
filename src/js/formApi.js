/**
 * Kostaryka — shared form transport (admin-ajax) and Cloudflare Turnstile helpers.
 * Used by contactForm.js (single oferta) and kontaktForm.js (/kontakt/).
 *
 * Config comes from the PHP side: window.kdcForms = { ajaxUrl, turnstileSiteKey, messages }.
 */

import { debugLog } from './utils.js';

function config() {
  return window.kdcForms || {};
}

/**
 * Localized message with a fallback
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
export function msg(key, fallback) {
  const messages = config().messages || {};
  return messages[key] || fallback;
}

/* ------------------------------------------------------------------
 * Turnstile
 * ---------------------------------------------------------------- */

const widgets = new WeakMap(); // slot element -> widget id

function turnstileSlot(form) {
  return config().turnstileSiteKey ? form.querySelector('.kdc-turnstile') : null;
}

/**
 * Render the widget into the form's slot. Returns true when rendered (or not needed).
 */
function renderTurnstile(form) {
  const slot = turnstileSlot(form);
  if (!slot) return true;
  if (widgets.has(slot)) return true;
  if (!window.turnstile) return false;

  // "interaction-only": the widget stays invisible and takes no space unless Cloudflare needs
  // the visitor to confirm something (then the checkbox appears above the submit button).
  const id = window.turnstile.render(slot, {
    sitekey: config().turnstileSiteKey,
    language: 'pl',
    theme: 'light',
    appearance: 'interaction-only',
    'before-interactive-callback': () => slot.classList.add('is-interactive'),
    'after-interactive-callback': () => slot.classList.remove('is-interactive'),
  });
  widgets.set(slot, id);
  debugLog('Turnstile rendered', form.id);
  return true;
}

/**
 * Lazy-render the widget when the form becomes visible (or gets focus), so forms that sit
 * in hidden containers (other breakpoint, closed popup) do not create widgets.
 * @param {HTMLFormElement} form
 */
export function setupTurnstile(form) {
  if (!turnstileSlot(form)) return;

  const tryRender = (attempt = 0) => {
    if (renderTurnstile(form)) return;
    if (attempt < 50) setTimeout(() => tryRender(attempt + 1), 200); // wait for api.js (up to 10 s)
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        tryRender();
      }
    });
    observer.observe(form); // the invisible widget has no area of its own
  }
  form.addEventListener('focusin', () => tryRender(), { once: true });
}

/**
 * @param {HTMLFormElement} form
 * @returns {boolean} true when the form has a widget
 */
export function hasTurnstile(form) {
  return !!turnstileSlot(form);
}

/**
 * @param {HTMLFormElement} form
 * @returns {string} Turnstile token or ''
 */
export function getTurnstileToken(form) {
  const field = form.querySelector('[name="cf-turnstile-response"]');
  return field ? field.value : '';
}

/**
 * Ask for a fresh token (tokens are single-use).
 * @param {HTMLFormElement} form
 */
export function resetTurnstile(form) {
  const slot = turnstileSlot(form);
  if (!slot) return;
  if (!widgets.has(slot)) {
    renderTurnstile(form);
    return;
  }
  if (window.turnstile) window.turnstile.reset(widgets.get(slot));
}

/**
 * Make sure the widget exists (called on submit, in case it was not rendered yet).
 * @param {HTMLFormElement} form
 */
export function ensureTurnstile(form) {
  renderTurnstile(form);
}

/* ------------------------------------------------------------------
 * Transport
 * ---------------------------------------------------------------- */

/**
 * POST the form to admin-ajax.
 * @param {string} action - wp_ajax action
 * @param {HTMLFormElement} form
 * @returns {Promise<{ok:boolean, message?:string, fields?:Object, code?:string, network?:boolean}>}
 */
export async function postForm(action, form) {
  const body = new FormData(form);
  body.set('action', action);

  let response;
  try {
    response = await fetch(config().ajaxUrl, {
      method: 'POST',
      body,
      credentials: 'same-origin',
    });
  } catch (error) {
    debugLog('Form request failed (network)', error);
    return { ok: false, network: true };
  }

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (json && json.success) {
    return { ok: true, message: json.data && json.data.message };
  }

  const data = (json && json.data) || {};
  debugLog('Form request rejected', response.status, data);
  return {
    ok: false,
    message: data.message,
    fields: data.fields || {},
    code: data.code || '',
  };
}

/**
 * Show an error under a field (same markup as the client-side validation).
 * @param {HTMLElement} field
 * @param {string} prefix - BEM block, e.g. "trip-contact-form" or "kontakt-form"
 * @param {string} text
 */
export function setFieldError(field, prefix, text) {
  const wrapper = field.closest(`.${prefix}__field`);
  if (!wrapper) return;

  wrapper.classList.add(`${prefix}__field--error`);
  let errorEl = wrapper.querySelector(`.${prefix}__field-error`);
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = `${prefix}__field-error`;
    errorEl.setAttribute('role', 'alert');
    wrapper.appendChild(errorEl);
  }
  errorEl.textContent = text;
}
