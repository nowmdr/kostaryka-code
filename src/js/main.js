/**
 * Kostaryka Trip Map - Main Entry Point
 * Version: 2.0.0 (Vite + Modular)
 */

// Импорт стилей
import '../css/loader.css';
import '../css/contact-form.css';
import '../css/kontakt-form.css';

// Импорт модулей
import { debugLog } from './utils.js';
import { initGallery } from './gallery.js';
import { initContactForm } from './contactForm.js';
import { initKontaktForm } from './kontaktForm.js';
import { initPopupManager } from './popupManager.js';
import { initTripDescriptionModal } from './tripDescriptionModal.js';

/**
 * Debug info
 */
if (window.location.search.indexOf('debug_trip_map=1') !== -1) {
  debugLog('=== KOSTARYKA TRIP MAP DEBUG ===');
  debugLog('tripMapData:', typeof tripMapData !== 'undefined' ? tripMapData : 'NOT LOADED');
  debugLog('Mode: Vite + ES Modules + Lazy Loading');
  debugLog('================================');
}

/**
 * Инициализация при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  initPopupManager();          // V1 + V2 popup handlers (context-aware)
  initGallery();               // Модуль галереи
  initContactForm();           // Formularz kontaktowy (single oferta)
  initKontaktForm();           // Formularz kontaktowy (strona /kontakt/)
  initTripDescriptionModal();  // trip_description дня → модалка Breakdance (single oferta)
});
