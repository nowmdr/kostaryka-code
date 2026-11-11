/**
 * Kostaryka cookie consent - standalone entry, loaded on every public page.
 *
 * Rule: nothing from Google is requested and no analytics cookie is written until the
 * visitor clicks "Akceptuję". "Odrzucam" (or no choice) = Google Analytics never loads.
 * The choice is kept in the first-party cookie `kdc_consent` (strictly necessary: it only
 * remembers the choice). It expires after 180 days, then the banner asks again.
 *
 * Public API: window.kdcConsent.{ get(), has('analytics'), open() }
 * Event: document 'kdc:consent-change' (detail: { analytics: boolean })
 * Reopen link: any element with [data-kdc-cookie-settings] or <a href="#cookie-settings">.
 */
import '../css/consent.css';

// The whole module is wrapped in a function. The built files are classic scripts that share
// one global scope with dist/main.js, whose minified names (t, e, ...) would otherwise clash
// with ours ("Identifier 't' has already been declared") and stop this script.
(function () {

const COOKIE_NAME = 'kdc_consent';
const SCHEMA = 1; // bump to ask every visitor again (e.g. when a new category is added)
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
const GA_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

let banner = null;
let gaId = '';
let state = null; // { v, analytics, g, t } or null = no decision yet
let analyticsLoaded = false;
let lastTrigger = null;

/* ---------------- cookie storage ---------------- */

function readConsent() {
  try {
    const row = document.cookie
      .split('; ')
      .find((part) => part.indexOf(COOKIE_NAME + '=') === 0);
    if (!row) return null;
    const data = JSON.parse(decodeURIComponent(row.slice(COOKIE_NAME.length + 1)));
    if (!data || data.v !== SCHEMA || typeof data.analytics !== 'boolean') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function writeConsent(analytics) {
  // g = 1 when a real GA ID existed at that moment (a yes given before GA existed is not valid later)
  const data = {
    v: SCHEMA,
    analytics: analytics,
    g: GA_ID_PATTERN.test(gaId) ? 1 : 0,
    t: Math.floor(Date.now() / 1000),
  };
  let cookie =
    COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(data)) +
    '; Max-Age=' + MAX_AGE_SECONDS + '; Path=/; SameSite=Lax';
  if (location.protocol === 'https:') cookie += '; Secure';
  try {
    document.cookie = cookie;
  } catch (e) {
    /* cookies blocked: the choice lives only in memory for this page view */
  }
  return data;
}

/* ---------------- Google Analytics ---------------- */

function loadAnalytics() {
  if (analyticsLoaded || !GA_ID_PATTERN.test(gaId)) return;
  analyticsLoaded = true;

  window['ga-disable-' + gaId] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

  // Consent Mode: analytics was agreed to, advertising signals stay off.
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', gaId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
  document.head.appendChild(script);
}

function deleteGaCookies() {
  const names = document.cookie
    .split('; ')
    .map((part) => part.split('=')[0])
    .filter((name) => /^_ga($|_)|^_gid$|^_gat/.test(name));
  if (!names.length) return;

  // Google may set them on the host or on any parent domain.
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) {
    domains.push('; domain=' + parts.slice(i).join('.'));
    domains.push('; domain=.' + parts.slice(i).join('.'));
  }
  names.forEach((name) => {
    domains.forEach((domain) => {
      document.cookie = name + '=; Max-Age=0; Path=/' + domain;
    });
  });
}

function disableAnalytics() {
  if (gaId) window['ga-disable-' + gaId] = true;
  deleteGaCookies();
}

/* ---------------- banner ---------------- */

function showBanner(fromUser) {
  if (!banner) return;
  const status = banner.querySelector('[data-kdc-status]');
  if (status) {
    if (state) {
      status.textContent = state.analytics
        ? status.getAttribute('data-text-granted')
        : status.getAttribute('data-text-denied');
      status.hidden = false;
    } else {
      status.hidden = true;
    }
  }
  banner.hidden = false;
  // Next frame so the slide-in transition runs.
  requestAnimationFrame(() => banner.classList.add('is-visible'));
  if (fromUser) {
    const first = banner.querySelector('[data-kdc-consent]');
    if (first) first.focus();
  }
}

function hideBanner() {
  if (!banner) return;
  banner.classList.remove('is-visible');
  banner.hidden = true;
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  lastTrigger = null;
}

function decide(analytics) {
  state = writeConsent(analytics);
  hideBanner();

  if (analytics) {
    loadAnalytics();
  } else {
    disableAnalytics();
    // Already loaded in this page view: only a reload guarantees gtag is gone.
    if (analyticsLoaded) {
      location.reload();
      return;
    }
  }
  document.dispatchEvent(
    new CustomEvent('kdc:consent-change', { detail: { analytics: analytics } })
  );
}

function init() {
  banner = document.getElementById('kdc-cookie-banner');
  if (!banner) return;
  gaId = (banner.getAttribute('data-ga-id') || '').trim();

  state = readConsent();
  // A "yes" saved while no GA ID existed (preview banner) must not switch GA on later.
  if (state && state.analytics && !state.g && GA_ID_PATTERN.test(gaId)) state = null;

  if (state && state.analytics) {
    loadAnalytics();
  } else {
    disableAnalytics(); // also cleans cookies left by an earlier consent
    if (!state) showBanner(false);
  }

  banner.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kdc-consent]');
    if (!button) return;
    decide(button.getAttribute('data-kdc-consent') === 'accept');
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-kdc-cookie-settings], a[href="#cookie-settings"]');
    if (!trigger) return;
    event.preventDefault();
    lastTrigger = trigger;
    showBanner(true);
  });

  window.kdcConsent = {
    get: () => (state ? { analytics: state.analytics, timestamp: state.t } : null),
    has: (category) => category === 'analytics' && !!(state && state.analytics),
    open: () => showBanner(true),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
