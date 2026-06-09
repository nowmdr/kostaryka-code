/**
 * Kostaryka Trip Map - Trip Description Modal
 * Подстановка trip_description дня маршрута в модалку Breakdance на single oferta CPT Wyprawy.
 *
 * Данные уже отрендерены в DOM (скрыты), AJAX/PHP не нужны.
 *
 * Контракт с Breakdance (key = заголовок дня trip_title):
 *   - Кнопка дня:      <button data-trip-desc-trigger="<key>">  (внутри <a data-action=popup>)
 *   - Источник текста: <div data-trip-desc-source="<key>">...WYSIWYG...</div>
 *   - Контейнер:       <div id="trip-desc-modal-content"></div>  (внутри попапа Breakdance)
 *
 * Breakdance сам открывает модалку (через <a data-action="popup">); мы только наполняем контейнер.
 */

import { debugLog } from './utils.js';

const TRIGGER_ATTR = 'data-trip-desc-trigger';
const SOURCE_ATTR = 'data-trip-desc-source';
const TARGET_ID = 'trip-desc-modal-content';

/**
 * Проверка, что мы на нужной странице (single oferta)
 * @returns {boolean}
 */
function isValidPage() {
  return document.body.classList.contains('single-oferta');
}

/**
 * Найти блок-источник описания по значению ключа.
 * Поиск идёт по значению атрибута (а не строковым CSS-селектором), т.к. ключ — это
 * произвольный заголовок trip_title (пробелы, кавычки и т.п.).
 * @param {string} key
 * @returns {HTMLElement|null}
 */
function findSourceByKey(key) {
  const sources = document.querySelectorAll(`[${SOURCE_ATTR}]`);
  for (const el of sources) {
    if (el.getAttribute(SOURCE_ATTR) === key) {
      return el;
    }
  }
  return null;
}

/**
 * Обработчик клика по кнопке дня.
 * Не блокируем событие — Breakdance сам откроет модалку, мы только наполняем контейнер.
 * @param {Event} e
 */
function handleTriggerClick(e) {
  // Клик приходит на вложенный <a>/svg/.__title — поднимаемся до кнопки с атрибутом
  const trigger = e.target.closest(`[${TRIGGER_ATTR}]`);
  if (!trigger) return;

  const key = trigger.getAttribute(TRIGGER_ATTR);
  debugLog('Trip Description: trigger clicked, key =', key);

  const source = findSourceByKey(key);
  if (!source) {
    debugLog(`Trip Description: source not found for key "${key}"`);
    return;
  }

  const target = document.getElementById(TARGET_ID);
  if (!target) {
    debugLog(`Trip Description: target #${TARGET_ID} not found in DOM`);
    return;
  }

  // trip_description — WYSIWYG/админский HTML, переносим innerHTML как есть
  target.innerHTML = source.innerHTML;
  debugLog('Trip Description: content injected into #' + TARGET_ID);
}

/**
 * Инициализация модуля.
 * Вызывается из main.js после загрузки DOM.
 */
export function initTripDescriptionModal() {
  // Проверка: только на single oferta
  if (!isValidPage()) {
    debugLog('Trip Description: Not on single-oferta page, skipping initialization');
    return;
  }

  // Делегирование на document: корректно работает даже если кнопки нет (условный показ)
  document.addEventListener('click', handleTriggerClick);

  debugLog('Trip Description: handler initialized ([' + TRIGGER_ATTR + '])');
}
