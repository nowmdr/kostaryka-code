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

import { showGlobalLoader, hideGlobalLoader, showError } from './loader.js';
import { ensureLeafletLoaded } from './leaflet-loader.js';
import {
  extractPostSlugFromButton,
  extractPostIdFromBody,
  getPostIdFromSlug,
  loadTripLocations
} from './ajax.js';
import { initMap } from './map.js';
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
 * Load and render map content (locations list + map)
 * @param {number} tripId - post ID
 */
async function loadAndRenderMapContent(tripId) {
  showGlobalLoader('Ładowanie mapy lokacji...');

  try {
    const [, locationsData] = await Promise.all([
      ensureLeafletLoaded(),
      loadTripLocations(tripId)
    ]);

    hideGlobalLoader();

    if (locationsData && locationsData.length > 0) {
      renderLocationsList(locationsData);
      initMap(locationsData);
    } else {
      showError('Brak lokacji dla tej wyprawy');
    }
  } catch (error) {
    console.error('Błąd:', error);
    hideGlobalLoader();
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }
}

/**
 * V1: Handle click on .trip-preview-btn (grid cards)
 * Extracts slug from button link href, looks up post ID via REST API.
 * @param {Event} e
 * @param {HTMLElement} clickedElement
 */
async function handleV1ButtonClick(e, clickedElement) {
  e.preventDefault();

  try {
    const postSlug = extractPostSlugFromButton(clickedElement);
    const tripId = await getPostIdFromSlug(postSlug);
    await loadAndRenderMapContent(tripId);
  } catch (error) {
    console.error('Błąd:', error);
    hideGlobalLoader();
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }
}

/**
 * V2: Handle click on .single-trip-gallery__preview-btn (main trip button)
 * Extracts post ID directly from body.postid-XXX class.
 * @param {Event} e
 */
async function handleV2ButtonClick(e) {
  e.preventDefault();

  try {
    const tripId = extractPostIdFromBody();

    if (!tripId) {
      throw new Error('Nie udało się pobrać ID wyprawy ze strony');
    }

    await loadAndRenderMapContent(tripId);
  } catch (error) {
    console.error('Błąd:', error);
    hideGlobalLoader();
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }
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
  });

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

  button.addEventListener('click', handleV2ButtonClick);

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
