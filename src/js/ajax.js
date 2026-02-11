/**
 * Kostaryka Trip Map - AJAX Functions
 */

import { debugLog } from './utils.js';

/**
 * Получить ID поста по slug через REST API
 * @param {string} slug - slug поста
 * @returns {Promise<number>} - ID поста
 */
export async function getPostIdFromSlug(slug) {
  debugLog('Получение ID поста для slug:', slug);

  const response = await fetch(
    `/wp-json/wp/v2/oferta?slug=${encodeURIComponent(slug)}&_fields=id`
  );

  if (!response.ok) {
    throw new Error('Nie udało się pobrać ID wyprawy');
  }

  const posts = await response.json();

  if (!posts || posts.length === 0) {
    throw new Error('Nie znaleziono wyprawy');
  }

  const tripId = posts[0].id;
  debugLog('Znaleziony ID postu:', tripId);

  return tripId;
}

/**
 * Загрузить локации через WordPress AJAX
 * @param {number} tripId - ID поста
 * @returns {Promise<Array>} - массив локаций
 */
export async function loadTripLocations(tripId) {
  // Проверка что tripMapData существует
  if (typeof tripMapData === 'undefined') {
    throw new Error('Błąd konfiguracji. Skontaktuj się z administratorem.');
  }

  debugLog('Загрузка локаций для trip ID:', tripId);

  const formData = new FormData();
  formData.append('action', 'get_trip_locations');
  formData.append('trip_id', tripId);
  formData.append('nonce', tripMapData.nonce);

  const response = await fetch(tripMapData.ajaxUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Błąd sieci');
  }

  const data = await response.json();
  debugLog('AJAX Response:', data);

  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.data || 'Błąd ładowania lokacji');
  }
}

/**
 * Извлечь slug поста из кнопки
 * @param {HTMLElement} button - кнопка "Podgląd"
 * @returns {string} - slug поста
 */
export function extractPostSlugFromButton(button) {
  // Находим wrapper .trip-preview-btn
  const wrapper = button.classList.contains('trip-preview-btn')
    ? button
    : button.closest('.trip-preview-btn');

  // Находим loop item
  const loopItem = wrapper.closest('.bde-loop-item');
  const postLink = loopItem ? loopItem.querySelector('a[href*="/oferta/"]') : null;

  if (!postLink) {
    throw new Error('Nie znaleziono linku do wyprawy');
  }

  const postUrl = postLink.getAttribute('href');
  const urlParts = postUrl.split('/').filter(Boolean);
  const postSlug = urlParts[urlParts.length - 1];

  debugLog('Znaleziono slug wyprawy:', postSlug);

  return postSlug;
}

/**
 * Извлечь ID поста из body class (для single страниц)
 * WordPress добавляет класс вида "postid-389" к body
 * @returns {number|null} - ID поста или null если не найден
 */
export function extractPostIdFromBody() {
  const bodyClasses = document.body.className;
  const match = bodyClasses.match(/postid-(\d+)/);

  if (match && match[1]) {
    const postId = parseInt(match[1], 10);
    debugLog('Znaleziono ID postu z body class:', postId);
    return postId;
  }

  debugLog('Nie znaleziono ID postu w body class');
  return null;
}
