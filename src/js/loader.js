/**
 * Kostaryka Trip Map - Loader Functions
 */

import { escapeHtml } from './utils.js';

const LOADER_ID = 'trip-map-global-loader';
const LEAVE_MS = 180; // keep in sync with .is-leaving in loader.css

let cancelHandler = null;

function onEscape(e) {
  if (e.key === 'Escape') cancelLoader();
}

/**
 * Cancel a visible loader: hide it and notify the caller that started it.
 */
function cancelLoader() {
  const callback = cancelHandler;
  hideGlobalLoader();
  if (callback) callback();
}

/**
 * Показать глобальный loader (затемнённый оверлей + карточка со спиннером).
 * Клик по оверлею или Escape отменяют загрузку.
 * @param {string} message - сообщение для отображения
 * @param {Function} [onCancel] - вызывается, если пользователь отменил загрузку
 */
export function showGlobalLoader(message = 'Ładowanie...', onCancel = null) {
  let loader = document.getElementById(LOADER_ID);

  if (!loader) {
    loader = document.createElement('div');
    loader.id = LOADER_ID;
    loader.className = 'trip-map-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner" aria-hidden="true"></div>
        <p class="loader-message">${escapeHtml(message)}</p>
      </div>
    `;
    loader.addEventListener('click', (e) => {
      if (e.target === loader) cancelLoader(); // click on the dimmed overlay only
    });
    document.body.appendChild(loader);
  } else {
    const messageEl = loader.querySelector('.loader-message');
    if (messageEl) messageEl.textContent = message;
  }

  cancelHandler = onCancel;
  document.addEventListener('keydown', onEscape);
  loader.classList.remove('is-leaving');
  loader.classList.add('is-visible');
}

/**
 * Скрыть глобальный loader
 */
export function hideGlobalLoader() {
  const loader = document.getElementById(LOADER_ID);
  if (loader) {
    loader.classList.remove('is-visible', 'is-leaving');
  }
  cancelHandler = null;
  document.removeEventListener('keydown', onEscape);
}

/**
 * Fade out the loader card only; the dimmed overlay stays so the dimming does not change.
 * Call hideGlobalLoader() afterwards (in the same tick as the popup opens).
 * @returns {Promise<void>} resolves when the card is gone
 */
export function fadeOutLoaderCard() {
  const loader = document.getElementById(LOADER_ID);
  if (!loader || !loader.classList.contains('is-visible')) {
    return Promise.resolve();
  }
  loader.classList.add('is-leaving');
  return new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
}

/**
 * Показать ошибку в контейнерах
 * @param {string} message - текст ошибки
 */
export function showError(message) {
  const errorHtml = `<div class="trip-map-error" style="text-align:center; padding:40px; color:#d63638;"><p>${escapeHtml(message)}</p></div>`;

  const locationsList = document.getElementById('locations-list');
  const mapContainer = document.getElementById('map-container');

  if (locationsList) locationsList.innerHTML = errorHtml;
  if (mapContainer) mapContainer.innerHTML = errorHtml;
}
