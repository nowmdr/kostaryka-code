/**
 * Kostaryka Trip Map - Gallery Module
 * Функционал для галереи на single oferta CPT Wyprawy
 *
 * Функциональность:
 * 1. Триггер открытия галереи: клик на кнопку → эмулирует клик на первую картинку
 * 2. Динамический счетчик: добавляет "(N)" к тексту кнопки
 */

import { debugLog } from './utils.js';

/**
 * Проверка, что мы на нужной странице (single oferta)
 * @returns {boolean}
 */
function isValidPage() {
  // Проверяем body класс single-oferta (WordPress добавляет для CPT)
  return document.body.classList.contains('single-oferta');
}

/**
 * Получить элементы галереи
 * @returns {Object|null} - объект с элементами или null
 */
function getGalleryElements() {
  const container = document.querySelector('.single-trip-gallery');
  if (!container) return null;

  const button = container.querySelector('.single-trip-gallery__button');
  const titleElement = button?.querySelector('.dan-arrow-button__title');
  const gallery = container.querySelector('.single-trip-gallery__gallery');
  const galleryItems = gallery?.querySelectorAll('a.ee-gallery-item') || [];
  const firstItem = galleryItems[0] || null;

  return {
    container,
    button,
    titleElement,
    gallery,
    galleryItems,
    firstItem,
    count: galleryItems.length
  };
}

/**
 * Установить триггер открытия галереи
 * @param {HTMLElement} button - кнопка галереи
 * @param {HTMLElement} firstItem - первый элемент галереи
 */
function setupGalleryTrigger(button, firstItem) {
  if (!button || !firstItem) {
    debugLog('Gallery: Cannot setup trigger - missing button or first item');
    return;
  }

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    debugLog('Gallery: Button clicked, triggering first gallery item');
    firstItem.click();
  });

  debugLog('Gallery: Trigger setup completed');
}

/**
 * Обновить счетчик изображений в тексте кнопки
 * @param {HTMLElement} titleElement - элемент с текстом кнопки
 * @param {number} count - количество изображений
 */
function updateImageCounter(titleElement, count) {
  if (!titleElement) {
    debugLog('Gallery: Cannot update counter - title element not found');
    return;
  }

  if (count === 0) {
    debugLog('Gallery: No images to count');
    return;
  }

  const currentText = titleElement.textContent.trim();

  // Проверяем, не добавлен ли уже счетчик
  if (/\(\d+\)$/.test(currentText)) {
    debugLog('Gallery: Counter already exists, skipping');
    return;
  }

  const newText = `${currentText} (${count})`;
  titleElement.textContent = newText;

  debugLog(`Gallery: Counter updated - ${count} images`);
}

/**
 * Инициализация модуля галереи
 * Вызывается из main.js после загрузки DOM
 */
export function initGallery() {
  // Проверка: только на single oferta
  if (!isValidPage()) {
    debugLog('Gallery: Not on single-oferta page, skipping initialization');
    return;
  }

  debugLog('Gallery: Initializing on single-oferta page...');

  // Получить элементы DOM
  const elements = getGalleryElements();

  // Edge case: контейнер галереи не найден
  if (!elements) {
    debugLog('Gallery: Container .single-trip-gallery not found');
    return;
  }

  // Edge case: кнопка не найдена
  if (!elements.button) {
    debugLog('Gallery: Button .single-trip-gallery__button not found');
    return;
  }

  // Edge case: галерея пустая
  if (elements.count === 0) {
    debugLog('Gallery: No gallery items found (empty gallery)');
    return;
  }

  // Edge case: первый элемент не найден (не должно быть, но проверим)
  if (!elements.firstItem) {
    debugLog('Gallery: First gallery item not found');
    return;
  }

  // Настроить триггер открытия галереи
  setupGalleryTrigger(elements.button, elements.firstItem);

  // Обновить счетчик изображений
  updateImageCounter(elements.titleElement, elements.count);

  debugLog('Gallery: Initialization completed successfully');
}
