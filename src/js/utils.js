/**
 * Kostaryka Trip Map - Utilities
 */

/**
 * Escape HTML для безопасности
 * @param {string} text - текст для экранирования
 * @returns {string} - экранированный текст
 */
export function escapeHtml(text) {
  const htmlMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => htmlMap[m]);
}

/**
 * Debug logging (только если ?debug_trip_map=1 в URL)
 * @param {...any} args - аргументы для логирования
 */
export function debugLog(...args) {
  if (window.location.search.indexOf('debug_trip_map=1') !== -1) {
    console.log('[Trip Map Debug]', ...args);
  }
}
