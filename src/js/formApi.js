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
 *
 * The challenge starts only when the visitor presses "send" (never while the form is just
 * displayed). The widget is "interaction-only": it stays invisible and takes no space, and
 * appears above the submit button only if Cloudflare needs the visitor to confirm something.
 * ---------------------------------------------------------------- */

const widgets = new WeakMap(); // slot element -> { id, token, waiters, onInteractive }
const TOKEN_TIMEOUT_MS = 60000;

function turnstileSlot(form) {
  return config().turnstileSiteKey ? form.querySelector('.kdc-turnstile') : null;
}

function flush(state, token) {
  const waiters = state.waiters.splice(0);
  waiters.forEach((resolve) => resolve(token));
}

/**
 * Wait for api.js (loaded with defer) for up to 10 seconds.
 * @returns {Promise<boolean>}
 */
function waitForApi() {
  return new Promise((resolve) => {
    let tries = 0;
    const check = () => {
      if (window.turnstile) return resolve(true);
      if (++tries > 50) return resolve(false);
      setTimeout(check, 200);
    };
    check();
  });
}

function renderWidget(slot) {
  const state = { id: null, token: '', waiters: [], onInteractive: null };

  state.id = window.turnstile.render(slot, {
    sitekey: config().turnstileSiteKey,
    language: 'pl',
    theme: 'light',
    appearance: 'interaction-only',
    callback: (token) => {
      state.token = token;
      flush(state, token);
    },
    'expired-callback': () => {
      state.token = '';
    },
    'error-callback': () => {
      state.token = '';
      flush(state, '');
    },
    'timeout-callback': () => {
      state.token = '';
      flush(state, '');
    },
    'before-interactive-callback': () => {
      slot.classList.add('is-interactive');
      if (state.onInteractive) state.onInteractive();
    },
    'after-interactive-callback': () => slot.classList.remove('is-interactive'),
  });

  widgets.set(slot, state);
  debugLog('Turnstile rendered', slot);
  return state;
}

/**
 * @param {HTMLFormElement} form
 * @returns {boolean} true when the form has a Turnstile slot (keys are configured)
 */
export function hasTurnstile(form) {
  return !!turnstileSlot(form);
}

/**
 * Run the challenge and return the token ('' when it failed or timed out).
 * @param {HTMLFormElement} form
 * @param {Function} [onInteractive] - called when the checkbox has to be shown
 * @returns {Promise<string>}
 */
export async function requestTurnstileToken(form, onInteractive) {
  const slot = turnstileSlot(form);
  if (!slot) return '';
  if (!(await waitForApi())) return '';

  const state = widgets.get(slot) || renderWidget(slot);
  state.onInteractive = onInteractive || null;
  if (state.token) return state.token;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(''), TOKEN_TIMEOUT_MS);
    state.waiters.push((token) => {
      clearTimeout(timer);
      resolve(token);
    });
  });
}

/**
 * Tokens are single-use: drop the widget so the next submit starts a fresh challenge.
 * @param {HTMLFormElement} form
 */
export function resetTurnstile(form) {
  const slot = turnstileSlot(form);
  if (!slot || !widgets.has(slot)) return;
  const state = widgets.get(slot);
  flush(state, '');
  widgets.delete(slot);
  slot.classList.remove('is-interactive');
  if (window.turnstile) window.turnstile.remove(state.id);
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
