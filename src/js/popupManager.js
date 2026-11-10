/**
 * Kostaryka Trip Map - Popup Manager
 * Unified popup initialization for homepage and single-oferta page.
 *
 * V1: .trip-preview-btn buttons (grid cards) → locations preview
 *     ID extracted from button link href → REST API slug lookup
 *
 * V2: .single-trip-gallery__preview-btn (main button) → trip preview
 *     ID extracted from body.postid-XXX class directly
 */

import { showGlobalLoader, hideGlobalLoader, fadeOutLoaderCard, showError } from './loader.js';
import { ensureLeafletLoaded } from './leaflet-loader.js';
import {
  extractPostSlugFromButton,
  extractPostIdFromBody,
  getPostIdFromSlug,
  loadTripLocations
} from './ajax.js';
import { initMap, refreshMap } from './map.js';
import { renderLocationsList } from './locations-list.js';
import { debugLog } from './utils.js';

/**
 * Detect if current page is single-oferta (single CPT Wyprawy)
 * @returns {boolean}
 */
function isSingleOferta() {
  return document.body.classList.contains('single-oferta');
}

/**
 * ID попапа Breakdance «Quick View» (локации + карта). Оба триггера
 * (V1 и V2) открывают именно его.
 */
const MAP_POPUP_ID = 399;

// The loader stays at least this long, so a fast response does not make it flash.
const MIN_LOADER_MS = 900;

// Каждая загрузка получает номер; отмена или новый клик делают старый номер устаревшим.
let loadToken = 0;

/**
 * @returns {Object|null} экземпляр попапа Breakdance или null, если он не инициализирован
 */
function getMapPopup() {
  const instances = window.breakdancePopupInstances;
  return (instances && instances[MAP_POPUP_ID]) || null;
}

/**
 * Open the map popup: show the loader first, load data while the popup is still
 * closed, then open the popup with its native Breakdance entrance animation.
 * @param {Function} resolveTripId - async function returning the trip post ID
 */
async function openMapModal(resolveTripId) {
  const token = ++loadToken;
  const minWait = new Promise((resolve) => setTimeout(resolve, MIN_LOADER_MS));

  showGlobalLoader('Ładowanie mapy lokacji...', () => {
    loadToken++;
  });

  try {
    const tripId = await resolveTripId();

    const [, locationsData] = await Promise.all([
      ensureLeafletLoaded(),
      loadTripLocations(tripId)
    ]);

    if (token !== loadToken) return; // cancelled or superseded

    if (locationsData && locationsData.length > 0) {
      renderLocationsList(locationsData);
      initMap(locationsData);
    } else {
      showError('Brak lokacji dla tej wyprawy');
    }
  } catch (error) {
    if (token !== loadToken) return;
    console.error('Błąd:', error);
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }

  await minWait;
  if (token !== loadToken) return;

  await fadeOutLoaderCard();
  if (token !== loadToken) return;

  revealMapModal();
}

/**
 * Open the popup and drop the loader in the same tick. The loader overlay has the
 * same colour as the popup overlay, so the dimming does not change between them.
 */
function revealMapModal() {
  try {
    const popup = getMapPopup();

    if (popup && !popup.isOpen()) {
      popup.open();
    }
  } catch (error) {
    console.error('Błąd otwierania okna:', error);
  } finally {
    // The loader must never stay on screen, even if opening the popup fails
    hideGlobalLoader();
  }

  // Leaflet must recalculate the container size once the popup is visible
  // and again after the entrance animation.
  requestAnimationFrame(refreshMap);
  setTimeout(refreshMap, 350);
}

/**
 * Stop Breakdance from opening the popup on click: we open it ourselves
 * after the data has loaded. Without a popup instance Breakdance keeps control.
 * @param {Event} e
 */
function takeOverClick(e) {
  e.preventDefault();
  if (getMapPopup()) {
    e.stopPropagation();
  }
}

/**
 * V1: Handle click on .trip-preview-btn (grid cards)
 * Extracts slug from button link href, looks up post ID via REST API.
 * @param {Event} e
 * @param {HTMLElement} clickedElement
 */
function handleV1ButtonClick(e, clickedElement) {
  takeOverClick(e);

  openMapModal(async () => {
    const postSlug = extractPostSlugFromButton(clickedElement);
    return getPostIdFromSlug(postSlug);
  });
}

/**
 * V2: Handle click on .single-trip-gallery__preview-btn (main trip button)
 * Extracts post ID directly from body.postid-XXX class.
 * @param {Event} e
 */
function handleV2ButtonClick(e) {
  takeOverClick(e);

  openMapModal(async () => {
    const tripId = extractPostIdFromBody();

    if (!tripId) {
      throw new Error('Nie udało się pobrać ID wyprawy ze strony');
    }

    return tripId;
  });
}

/**
 * V1 handler: event delegation for .trip-preview-btn buttons
 * Works on all pages (homepage grid and single-oferta grid).
 */
function initV1Handlers() {
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.trip-preview-btn, .trip-preview-btn button');
    if (!button) return;
    handleV1ButtonClick(e, button);
  }, true); // capture phase: runs before Breakdance's popup handler

  debugLog('Popup Manager: V1 handlers initialized (.trip-preview-btn)');
}

/**
 * V2 handler: direct listener on .single-trip-gallery__preview-btn
 * Only relevant on single-oferta page.
 */
function initV2Handlers() {
  const button = document.querySelector('.single-trip-gallery__preview-btn');

  if (!button) {
    debugLog('Popup Manager: V2 button not found, skipping');
    return;
  }

  button.addEventListener('click', handleV2ButtonClick, true); // capture phase

  debugLog('Popup Manager: V2 handler initialized (.single-trip-gallery__preview-btn)');
}

/**
 * Initialize popup handlers based on page context.
 *
 * Homepage:      V1 only (grid cards)
 * Single-oferta: V1 (grid cards) + V2 (main trip button)
 */
export function initPopupManager() {
  if (isSingleOferta()) {
    initV1Handlers();
    initV2Handlers();
    debugLog('Popup Manager: single-oferta mode (V1 + V2)');
  } else {
    initV1Handlers();
    debugLog('Popup Manager: homepage mode (V1 only)');
  }
}
