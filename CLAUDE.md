# CLAUDE.md - История разработки плагина Kostaryka Trip Map

## 📋 СОДЕРЖАНИЕ
1. [Обзор проекта](#обзор-проекта)
2. [Исходная задача](#исходная-задача)
3. [Технический стек](#технический-стек)
4. [Процесс разработки](#процесс-разработки)
5. [Архитектура решения](#архитектура-решения)
6. [Проблемы и решения](#проблемы-и-решения)
7. [Текущее состояние](#текущее-состояние)
8. [Дальнейшее развитие](#дальнейшее-развитие)

---

## 📖 ОБЗОР ПРОЕКТА

### Назначение плагина
**Kostaryka Trip Map** - это WordPress плагин для кастомизации сайта, построенного на Breakdance builder. Основная функциональность - интерактивная карта локаций для Custom Post Type "Wyprawy" (Путешествия).

### Важно понимать
Этот плагин создан НЕ только для функциональности карты. Он служит **универсальной базой для всех будущих кастомизаций** сайта, которые требуют JavaScript, PHP или AJAX функциональности.



**ПРОБЛЕМА:** В Breakdance `%%ID%%` в data-атрибутах не работал корректно.

**РЕШЕНИЕ:** Извлекать ID из URL соседней ссылки через REST API:

**Почему это надежно:**
- URL поста всегда корректный
- REST API - стандарт WordPress
- Не зависит от Breakdance динамических данных
- Работает всегда, даже если структура HTML изменится

---

## 🗺️ ФИЧА: Описание дня маршрута (`trip_description`) в модалке Breakdance

**Дата:** 2026-06-09
**Страница:** single Wyprawy (CPT `oferta`, `body.single-oferta`)
**Файлы:** [`src/js/tripDescriptionModal.js`](src/js/tripDescriptionModal.js), регистрация в [`src/js/main.js`](src/js/main.js). PHP не менялся.

### Назначение
На странице путешествия есть ACF-репитер **`trip_list`** — дни маршрута (поля `trip_day / trip_title / trip_image / trip_description`). У каждой строки есть кнопка «Opis Wyprawy» (показывается условно, может отсутствовать). По клику открывается **одна общая** модалка Breakdance, в которую нужно подставить `trip_description` именно того дня, чья кнопка нажата.

### Ключевое решение: DOM, а не AJAX
В отличие от карты (`get_trip_locations` через AJAX), здесь `trip_description` **уже отрендерен на странице** (в скрытом rich-text блоке). Поэтому серверный запрос не нужен — JS просто копирует готовый HTML описания в контейнер модалки. По форме поток тот же, что у карты (клик → определяем источник → инжектим в контейнер по `id`), но без раунд-трипа на сервер. **AJAX-экшен и PHP не добавлялись.**

### Контракт с Breakdance (настраивается в билдере)
Связь «кнопка → описание» строится по **общему ключу = заголовку дня `trip_title`** (Breakdance `%%ID%%` ненадёжен, поэтому используем явные data-атрибуты):

| Что | Атрибут / id | Пример |
|-----|--------------|--------|
| Кнопка дня (`<button>`) | `data-trip-desc-trigger="<key>"` | `data-trip-desc-trigger="Bienvenido a Costa Rica"` |
| Источник текста (rich-text блок) | `data-trip-desc-source="<key>"` | тот же ключ |
| Контейнер в модалке | `id="trip-desc-modal-content"` | — |

> Внутри `<button>` лежит `<a data-action="popup" popupId:1099>` — **сам Breakdance** открывает модалку. JS только наполняет контейнер.

### Как работает JS ([`tripDescriptionModal.js`](src/js/tripDescriptionModal.js))
1. Гейт по `body.single-oferta` (иначе выход).
2. Делегирование клика на `document`: `e.target.closest('[data-trip-desc-trigger]')` — клик по вложенному `<a>`/svg/`.__title` корректно поднимается до кнопки. Если кнопки нет (условный показ) — делегация просто ничего не делает, без ошибок.
3. **Не вызываем** `preventDefault()` / `stopPropagation()` — чтобы не мешать Breakdance открыть попап.
4. Источник ищем **по значению атрибута** (перебор `[data-trip-desc-source]` + сравнение `getAttribute`), а не строковым CSS-селектором — ключ это произвольный заголовок с пробелами/кавычками.
5. `target.innerHTML = source.innerHTML` — переносим WYSIWYG как есть.
6. Логи через `debugLog(...)` (видно при `?debug_trip_map=1`).

### Ограничения
- Ключ `trip_title` должен быть **уникален** в пределах страницы — при дублях берётся первое совпадение. Если заголовки могут повторяться — переходить на индекс/уникальный ключ.

### Пересборка
После правок в `src/js/` обязательно `npm run build` (Vite) — перегенерит `dist/main.js`, который подключает WordPress. Без билда правки на сайт не попадут.

---

## 📨 ФИЧА: Контактная форма на single Wyprawy — мультиэкземпляр, модалка, адаптив сабмита

**Дата:** 2026-06-10
**Страница:** single Wyprawy (CPT `oferta`, `body.single-oferta`); п.3 затрагивает и страницу `/kontakt/`
**Файлы:** [`kostaryka-trip-map.php`](kostaryka-trip-map.php) (рендер шорткодов), [`src/css/contact-form.css`](src/css/contact-form.css), [`src/css/kontakt-form.css`](src/css/kontakt-form.css). JS **не менялся** — формы инициализирует существующий [`initContactForm()`](src/js/contactForm.js).

> **Superseded 2026-11-10:** the statement "JS was not changed" no longer holds. The forms now post to a PHP backend; see "FEATURE: Contact forms backend" at the end of this file.

### Назначение
По дизайну форму-шорткод нужно размещать **в двух секциях** одной страницы (вверху и внизу), а при определённых условиях/устройствах — ещё и в **модалке Breakdance** (с чуть другим оформлением шапки). Плюс на тач-ширинах кнопка отправки должна вести себя иначе.

### 1. Несколько форм на странице без конфликта (атрибут `key`)
**Проблема:** `render_contact_form()` строил все `id` из ID поста (`trip-contact-form-<postID>`), одинакового для обоих шорткодов → дубли `id` и целей `<label for>`. Клик по label/чекбоксу нижней формы срабатывал на верхней, фокус «прыгал».

**Решение:** у `[trip_contact_form]` появился необязательный атрибут-модификатор `key` + авто-счётчик как fallback (значение прогоняется через `sanitize_title()`):

| Использование | Итоговый префикс id |
|---------------|---------------------|
| `[trip_contact_form key="top"]` | `trip-contact-form-<postID>-top` |
| `[trip_contact_form]` (без key) | `trip-contact-form-<postID>-1`, `-2`, … (статический `$instance`) |

**Ключи на одной странице должны различаться** (одинаковый key = снова дубль). Тот же приём давно был у `[contact_form]` (`render_kontakt_form`, `static $instance`) — в trip-форму его просто не добавили.

### 2. Вариант для модалки (`[trip_contact_form_modal]`)
Те же поля и данные (дата, имя, e-mail, сообщение, согласие + цена/срок/инфо из ACF) и **та же белая кнопка отправки**; отличается только оформление шапки (заголовок поездки в белой карточке + разделители) — по [Figma 7664:13354](https://www.figma.com/design/DXodhSuo6CvglVljU4s99p/Kostaryka-Dla-Ciebie?node-id=7664-13354&m=dev).

**Ключевое решение:** один и тот же BEM-блок `.trip-contact-form` + CSS-модификатор `.trip-contact-form--modal`, а не отдельный блок. Поэтому **JS не дублируется** — `initContactForm()` ловит форму по классу автоматически.

| Что | Реализация |
|-----|-----------|
| Шорткод | `[trip_contact_form_modal key="modal"]` — вставляется в попап Breakdance |
| PHP | общий приватный хелпер `render_trip_contact_form_html($atts, $variant)`; публичные `render_contact_form` (`inline`) и `render_contact_form_modal` (`modal`) делегируют ему. Вывод варианта `inline` **не изменился** |
| Отличия `modal` | класс `--modal` на обёртке; шапка-карточка рендерится **всегда** (ради заголовка `<p class="trip-contact-form__title">`) |
| CSS | блок `.trip-contact-form--modal …` в `contact-form.css`; значения переиспользуют **уже существующие в файле** (CSS-переменных в проекте нет, `font-family` наследуется из темы) |

> Кнопку-триггер и условия показа модалки (разрешение/устройство) настраивает сам Breakdance; попап он открывает сам.

### 3. Адаптив кнопки отправки (< 1119px)
Во **всех** формах (`.trip-contact-form__submit` и `.kontakt-form__submit`) на тач-ширинах:
- кнопка **на всю ширину** (`width:100%` + `flex:1` на тексте + центрирование);
- **выключен hover-эффект** (сдвиг стрелки + морфинг скруглений) — возвращается resting-состояние.

Сделано блоком `@media (max-width: 1118.98px)` в конце `contact-form.css` и `kontakt-form.css` — переопределяются только те свойства, что меняет hover. На ≥1119px поведение прежнее.

### Пересборка
Правки в `src/css/` бандлятся в `dist/main.css` через импорт в [`main.js`](src/js/main.js) → нужен `npm run build` (Vite). Изменения только в `kostaryka-trip-map.php` сборки **не** требуют.

---

## 🗺️ FEATURE: Locations map modal (`popupManager.js`)

**Date:** 2026-11-10
**Pages:** single Wyprawy (`body.single-oferta`) and trip cards with `.trip-preview-btn` (the V1 handler runs on every page, for example `/oferta/` and the homepage)
**Status:** accepted by the user on 2026-11-10
**Files:** [`src/js/popupManager.js`](src/js/popupManager.js) (triggers, open flow), [`src/js/loader.js`](src/js/loader.js) (loader card), [`src/js/map.js`](src/js/map.js) (Leaflet map, marker popups), [`src/js/locations-list.js`](src/js/locations-list.js) (location cards), [`src/css/loader.css`](src/css/loader.css), [`src/css/map-modal.css`](src/css/map-modal.css) (imported last in `main.js`), [`kostaryka-trip-map.php`](kostaryka-trip-map.php) (`asset_version()`). Breakdance popup setup and deploy notes: root repo `docs/project/map-modal.md`.

### Triggers
Both triggers open the same Breakdance popup, `MAP_POPUP_ID = 399`:

| Trigger | Element class | Button label | Where |
|---------|---------------|--------------|-------|
| V1 | `.trip-preview-btn` | "Szybki podgląd" | trip cards |
| V2 | `.single-trip-gallery__preview-btn` | "Zobacz na mapie" | single trip page; the handler is attached only on `body.single-oferta` |

V1 gets the trip ID from the card's link (slug, then REST lookup). V2 reads it from the `body.postid-…` class.

### Open flow
1. A capture-phase click listener calls `preventDefault()`. It calls `stopPropagation()` only when `window.breakdancePopupInstances[399]` exists. Without it, Breakdance keeps the click.
2. The plugin loader appears. Its overlay is `#000000BF`, the same colour as the popup overlay, so the dimming does not jump when the popup opens. The card is white with a spinner in the palette accent colour. A click on the overlay or the Escape key cancels the load.
3. The trip ID, Leaflet and the locations load while the popup is still closed.
4. The loader stays for at least 900 ms (`MIN_LOADER_MS`).
5. The loader card fades out in 180 ms (`LEAVE_MS`). Then `popup.open()` runs (Breakdance's own entrance animation) and the loader is hidden in the same tick. The hide runs in `finally`, so the loader never stays on screen, even if `open()` throws.
6. Leaflet `invalidateSize()` runs on the next animation frame and again after 350 ms.

Each load has a token. A cancel or a new click makes an older load stop without touching the modal. Errors replace the list and the map area with a message (`showError`).

### Map, list and CSS
- Clicking a location card opens its marker popup (name and photo) on the map. This is intended.
- Location photos use a fixed ratio with `object-fit: cover`: 4:3 on desktop; at `max-width: 1119px` 8:5, and the cards are `min(17rem, 78vw)` wide.
- Marker popup: `min(200px, 60vw)` wide, 4:3 photo, `keepInView` pans the map so the popup stays inside it.
- At `max-width: 1119px` the close button gets `--closeButtonOutsideOffset: 36px` and `translate(-125%, -50px)`, with `z-index: 1100`. The map container has `isolation: isolate`, so the Leaflet panes (z-index 400–1000) cannot cover it.
- Image URLs and names go through `escapeHtml` in the list and in the marker popup.
- The list's click listener is a named function, so re-rendering does not add a second copy.
- Loader classes are scoped under `.trip-map-loader`.
- `map-modal.css` selectors use `.bde-popup-399-100`, so they depend on the popup ID as well.

### Build and cache
- `asset_version()` appends the plugin version and the `filemtime` of `dist/main.css` and `dist/main.js` to the enqueue URLs. Before, the fixed `?ver=2.0.0` let browsers keep old files.
- `main.js` imports `map-modal.css` last, after the Leaflet CSS, so its rules win.
- Build with `npm run build`. Upload: see root `docs/project/site-environment.md` → "Plugin deployment".

---

## 📨 FEATURE: Contact forms backend (`class-kdc-forms.php`)

**Date:** 2026-11-10
**Pages:** single Wyprawy (`body.single-oferta`: both trip forms and the modal form) and `/kontakt/` (`[contact_form]`)
**Status:** written and built on 2026-11-10. The plugin zip with this backend was uploaded to the test server on 2026-11-10: plugin class, ACF group and real submissions checked; mail delivery not confirmed. The Turnstile widget change (`appearance: 'interaction-only'`) was deployed on 2026-11-10 (checked in headless Chrome only).
**Files:** [`includes/class-kdc-forms.php`](includes/class-kdc-forms.php) (new, class `Kostaryka_Forms`, loaded from [`kostaryka-trip-map.php`](kostaryka-trip-map.php)), [`src/js/formApi.js`](src/js/formApi.js) (new), [`src/js/contactForm.js`](src/js/contactForm.js), [`src/js/kontaktForm.js`](src/js/kontaktForm.js), [`src/css/contact-form.css`](src/css/contact-form.css). Settings, deploy order and tests: root `docs/project/forms.md`.

Before this feature both front-end forms only validated the input and then faked success (`setTimeout`, `console.log`). There was no PHP handler, no e-mail and no captcha.

### Endpoints
- AJAX actions `kdc_trip_form` and `kdc_contact_form`, registered for logged-in and logged-out users (`wp_ajax_` and `wp_ajax_nopriv_`).
- `formApi.js` sends a FormData POST to admin-ajax.

### Request flow (PHP)
1. Honeypot field `kdc_website`: a bot that fills it gets a fake success and nothing is sent.
2. Rate limit: 5 requests per 10 minutes per IP, stored in the transient `kdc_form_rl_<md5(ip)>`.
3. Validation and sanitising: name 2–120 characters, valid e-mail, message 5–5000 characters, consent required. The post ID and title come from the server, not from the visitor. A trip date must be in the trip's `trip_available_dates`, and the "no date" switch is enforced on the server too.
4. Cloudflare Turnstile `siteverify`, only when both keys are set. The check fails closed.
5. `wp_mail()` with plain text and `Reply-To` set to the visitor. Subjects: `[Kostaryka] Zapytanie o wyprawę: <title>` (trip form) and `[Kostaryka] Wiadomość z formularza kontaktowego` (contact form). The consent timestamp is in the body; the IP address is not.

### Responses
| HTTP status | Meaning |
|-------------|---------|
| 422 | Validation error, with a message per field |
| 429 | Rate limit reached |
| 503 | Turnstile check could not be completed |
| 500 | Mail could not be sent |

### Settings read by the code
- ACF group `group_kdc_forms` on the options page `global-settings` ("Ustawienia Globalne"). Field names and their meaning: root `docs/project/forms.md`.
- Constants `KDC_TURNSTILE_SITE_KEY` and `KDC_TURNSTILE_SECRET_KEY` (wp-config.php) override the ACF fields. No key is stored in the repository.

### Front end
- `formApi.js`: admin-ajax POST, lazy Turnstile render (IntersectionObserver on the form, or focus), single-use token reset, field error helper.
- `contactForm.js` and `kontaktForm.js` use `formApi.js`. No `console.log` of personal data, a double-submit guard, and a network error message.
- Config object `window.kdcForms` (ajaxUrl, Turnstile site key, Polish messages), localised in `do_enqueue_scripts()`.
- Turnstile `api.js?render=explicit` is enqueued only on single oferta and `/kontakt/`, and only when both keys are set.
- CSS in `contact-form.css`: `.kdc-hp` (honeypot field), `.kdc-turnstile`, and `.kdc-turnstile.is-interactive` (16px gap above the submit button).
- Turnstile widget appearance: `interaction-only` (decided 2026-11-10). The widget is invisible and zero height unless Cloudflare needs an interaction. The class `is-interactive` is set by the `before-interactive-callback` / `after-interactive-callback` options. Details and decision: root `docs/project/forms.md`, section "Turnstile widget".

### Decisions
- The nonce that the shortcodes print is **not** checked. The forms are anonymous, and cached pages can hold stale nonces. Protection: honeypot, rate limit and Turnstile.
- Submissions are not stored in the database; they are only e-mailed.

### Build and deploy
- `npm run build`: the first 2026-11-10 upload had `dist/main.js` at 169429 bytes. The Turnstile interaction-only build (169594 bytes `dist/main.js`, 27610 bytes `dist/main.css`) was deployed on 2026-11-10 with a newer zip. `dist/` is git-ignored.
- Deploy: one zip through the WordPress dashboard ("Replace current with uploaded"). The zip contains the folder `kostaryka-code` with `dist/` and `includes/`, and must not contain `node_modules` or `.git`. PHP and JS arrive together, so no upload order applies. Steps and test results: root `docs/project/forms.md`.
- `asset_version()` appends the file modification time to the `dist` URLs, so the URLs change when the files change.

### Not tested yet
Mail delivery (not confirmed), a full Turnstile solve by a person, the normal-browser case of the new widget (no widget shown) and its phone behaviour (the interactive case was seen in headless Chrome only), the 429 response, the switch-off no-date case, the Reply-To header, and the ACF tabs (only the group registration was checked). See root `docs/project/forms.md`.
