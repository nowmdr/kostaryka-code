<?php
/**
 * Plugin Name: Kostaryka Code
 * Plugin URI: https://kostaryka.pl
 * Description: Interaktywna mapa lokacji dla Custom Post Type "Wyprawy" z Leaflet.js i OpenStreetMap
 * Version: 2.0.0
 * Author: Jauhien
 * Author URI: https://kostaryka.pl
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: kostaryka-trip-map
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

// Zabezpieczenie przed bezpośrednim dostępem
if (!defined("ABSPATH")) {
    exit();
}

// Definicja stałych
define("KOSTARYKA_TRIP_MAP_VERSION", "2.0.0");
define("KOSTARYKA_TRIP_MAP_PLUGIN_DIR", plugin_dir_path(__FILE__));
define("KOSTARYKA_TRIP_MAP_PLUGIN_URL", plugin_dir_url(__FILE__));

/**
 * Główna klasa pluginu
 */
class Kostaryka_Trip_Map
{
    /**
     * Singleton instance
     */
    private static $instance = null;

    /**
     * Pobierz instancję
     */
    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Konstruktor
     */
    private function __construct()
    {
        $this->init_hooks();
    }

    /**
     * Inicjalizacja hooks
     */
    private function init_hooks()
    {
        // Podłączanie skryptów i stylów
        add_action("wp_enqueue_scripts", [$this, "enqueue_scripts"]);

        // AJAX endpoints
        add_action("wp_ajax_get_trip_locations", [$this, "get_trip_locations"]);
        add_action("wp_ajax_nopriv_get_trip_locations", [
            $this,
            "get_trip_locations",
        ]);

        // Shortcode formularza kontaktowego
        add_shortcode("trip_contact_form", [$this, "render_contact_form"]);

        // Admin notices (opcjonalne)
        add_action("admin_notices", [$this, "check_dependencies"]);
    }

    /**
     * Sprawdzanie zależności (ACF)
     */
    public function check_dependencies()
    {
        if (!function_exists("get_field")) { ?>
            <div class="notice notice-warning is-dismissible">
                <p><strong>Kostaryka Trip Map:</strong> Plugin wymaga Advanced Custom Fields (ACF) Pro do działania.</p>
            </div>
            <?php }
    }

    /**
     * Warunkowe ładowanie skryptów
     * Ładujemy tylko na: homepage, single oferta, strona oferta
     */
    public function enqueue_scripts()
    {
        $should_load = false;

        // 1. Strona główna
        if (is_front_page() || is_home()) {
            $should_load = true;
        }

        // 2. Single post typu "oferta"
        if (is_singular("oferta")) {
            $should_load = true;
        }

        // 3. Strona ze slug "oferta"
        if (is_page("oferta")) {
            $should_load = true;
        }

        // Jeśli nie trzeba ładować - wychodzimy
        if (!$should_load) {
            return;
        }

        // Ładujemy skrypty
        $this->do_enqueue_scripts();

        // Lokalizacja danych formularza kontaktowego (tylko na single oferta)
        if (is_singular("oferta")) {
            $this->localize_contact_form_data();
        }
    }

    /**
     * Ładowanie skryptów i stylów
     */
    private function do_enqueue_scripts()
    {
        // CSS z Vite bundle (zawiera loader.css + leaflet.css)
        wp_enqueue_style(
            "kostaryka-trip-map",
            KOSTARYKA_TRIP_MAP_PLUGIN_URL . "dist/main.css",
            [],
            KOSTARYKA_TRIP_MAP_VERSION,
        );

        // JS z Vite bundle (wszystkie moduły + Leaflet)
        wp_enqueue_script(
            "kostaryka-trip-map",
            KOSTARYKA_TRIP_MAP_PLUGIN_URL . "dist/main.js",
            [],
            KOSTARYKA_TRIP_MAP_VERSION,
            true,
        );

        // Lokalizacja danych dla JS (leafletCssUrl i leafletJsUrl już не нужны)
        wp_localize_script("kostaryka-trip-map", "tripMapData", [
            "ajaxUrl" => admin_url("admin-ajax.php"),
            "nonce" => wp_create_nonce("trip_map_nonce"),
            "pluginUrl" => KOSTARYKA_TRIP_MAP_PLUGIN_URL,
        ]);
    }

    /**
     * AJAX handler - pobieranie lokacji wyprawy
     */
    public function get_trip_locations()
    {
        // Проверка nonce
        if (!check_ajax_referer("trip_map_nonce", "nonce", false)) {
            wp_send_json_error("Invalid nonce");
            return;
        }

        // Получаем trip_id
        $trip_id = isset($_POST["trip_id"]) ? intval($_POST["trip_id"]) : 0;

        if (!$trip_id) {
            wp_send_json_error("Invalid trip ID");
            return;
        }

        // DEBUG: Проверяем статус поста
        $post_status = get_post_status($trip_id);
        $post_type = get_post_type($trip_id);

        // DEBUG: Отправляем информацию для отладки
        if (!$post_status) {
            wp_send_json_error("Post does not exist. ID: " . $trip_id);
            return;
        }

        if ($post_status !== "publish") {
            wp_send_json_error(
                "Post status is: " .
                    $post_status .
                    ", post type: " .
                    $post_type,
            );
            return;
        }

        // Проверка ACF
        if (!function_exists("get_field")) {
            wp_send_json_error("ACF not available");
            return;
        }

        // Получаем локации
        $locations = get_field("location", $trip_id);

        // DEBUG: Проверяем что вернул ACF
        if (!$locations) {
            wp_send_json_error(
                "ACF returned empty. Field name: location, Post ID: " .
                    $trip_id,
            );
            return;
        }

        if (!is_array($locations)) {
            wp_send_json_error(
                "ACF returned non-array: " . gettype($locations),
            );
            return;
        }

        // Форматируем данные
        $formatted_locations = $this->format_locations($locations);

        // Успех!
        wp_send_json_success($formatted_locations);
    }

    /**
     * Formatowanie danych lokacji
     */
    private function format_locations($locations)
    {
        $formatted = [];

        foreach ($locations as $location) {
            // Współrzędne
            $latitude = isset($location["location_latitude"])
                ? floatval($location["location_latitude"])
                : null;
            $longitude = isset($location["location_longitude"])
                ? floatval($location["location_longitude"])
                : null;

            // Obrazek
            $image_url = "";
            if (isset($location["location_image"])) {
                if (is_array($location["location_image"])) {
                    $image_url = $location["location_image"]["url"] ?? "";
                } elseif (is_numeric($location["location_image"])) {
                    $image_url = wp_get_attachment_image_url(
                        $location["location_image"],
                        "medium",
                    );
                }
            }

            $formatted[] = [
                "name" => $location["location_name"] ?? "",
                "description" => $location["location_description"] ?? "",
                "image" => $image_url,
                "latitude" => $latitude,
                "longitude" => $longitude,
                "has_coordinates" =>
                    $latitude !== null &&
                    $longitude !== null &&
                    $latitude !== 0 &&
                    $longitude !== 0,
            ];
        }

        return $formatted;
    }

    /**
     * Lokalizacja danych formularza kontaktowego dla JS
     */
    private function localize_contact_form_data()
    {
        if (!function_exists("get_field")) {
            return;
        }

        $post_id = get_the_ID();
        if (!$post_id) {
            return;
        }

        wp_localize_script("kostaryka-trip-map", "tripContactFormData", [
            "nonce" => wp_create_nonce("trip_contact_form_nonce"),
            "ajaxUrl" => admin_url("admin-ajax.php"),
            "postTitle" => get_the_title($post_id),
            "messages" => [
                "success" => "Dziękujemy! Wiadomość została wysłana.",
                "error" => "Wystąpił błąd. Spróbuj ponownie.",
                "required" => "To pole jest wymagane",
                "invalidEmail" => "Podaj poprawny adres e-mail",
                "noDates" => "Brak dostępnych terminów",
            ],
        ]);
    }

    /**
     * Shortcode [trip_contact_form] - renderowanie formularza kontaktowego
     *
     * @return string HTML formularza
     */
    public function render_contact_form()
    {
        if (!function_exists("get_field")) {
            return '<p class="trip-contact-form__error">Formularz niedostępny.</p>';
        }

        $post_id = get_the_ID();
        if (!$post_id) {
            return "";
        }

        $post_title = get_the_title($post_id);

        // Dane nagłówka z grupy contact_form_info
        $contact_form_info = get_field("contact_form_info", $post_id);
        $price = !empty($contact_form_info["trip_price"])
            ? $contact_form_info["trip_price"]
            : "";
        $days = !empty($contact_form_info["trip_days"])
            ? $contact_form_info["trip_days"]
            : "";
        $additional_info = !empty(
            $contact_form_info["trip_additional_form_info"]
        )
            ? $contact_form_info["trip_additional_form_info"]
            : "";

        // Dostępne terminy z repeatera trip_available_dates
        $available_dates = get_field("trip_available_dates", $post_id);
        $has_dates = !empty($available_dates) && is_array($available_dates);

        $nonce = wp_create_nonce("trip_contact_form_nonce");
        $form_id = "trip-contact-form-" . esc_attr($post_id);

        ob_start();
        ?>
        <div class="trip-contact-form"
             data-post-id="<?php echo esc_attr($post_id); ?>"
             data-post-title="<?php echo esc_attr($post_title); ?>"
             data-nonce="<?php echo esc_attr($nonce); ?>">

            <?php if ($price || $days || $additional_info): ?>
            <div class="trip-contact-form__header">
                <?php if ($price || $days): ?>
                <div class="trip-contact-form__price-row">
                    <?php if ($price): ?>
                    <span class="trip-contact-form__price"><?php echo esc_html(
                        $price,
                    ); ?></span>
                    <?php endif; ?>
                    <?php if ($days): ?>
                    <span class="trip-contact-form__duration"><?php echo esc_html(
                        $days,
                    ); ?></span>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
                <?php if ($additional_info): ?>
                <div class="trip-contact-form__info">
                    <svg class="trip-contact-form__info-icon" aria-hidden="true" focusable="false" width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.25 0C10.438 0 12.5368 0.868841 14.084 2.41602C15.6312 3.96319 16.5 6.06196 16.5 8.25C16.5 9.3334 16.2867 10.4063 15.8721 11.4072C15.4575 12.4081 14.8501 13.3179 14.084 14.084C13.3179 14.8501 12.4081 15.4575 11.4072 15.8721C10.4063 16.2867 9.3334 16.5 8.25 16.5C7.16659 16.5 6.09371 16.2867 5.09277 15.8721C4.09186 15.4575 3.18208 14.8501 2.41602 14.084C1.64995 13.3179 1.04253 12.4081 0.62793 11.4072C0.213328 10.4063 0 9.33341 0 8.25C5.96046e-08 6.06196 0.868841 3.96319 2.41602 2.41602C3.96319 0.868841 6.06196 0 8.25 0ZM8.25 1.5C6.45979 1.5 4.74243 2.21069 3.47656 3.47656C2.21069 4.74243 1.5 6.45979 1.5 8.25C1.5 9.13637 1.67449 10.0141 2.01367 10.833C2.35289 11.652 2.84977 12.3966 3.47656 13.0234C4.10336 13.6502 4.84805 14.1471 5.66699 14.4863C6.4859 14.8255 7.36363 15 8.25 15C9.13637 15 10.0141 14.8255 10.833 14.4863C11.652 14.1471 12.3966 13.6502 13.0234 13.0234C13.6502 12.3966 14.1471 11.652 14.4863 10.833C14.8255 10.0141 15 9.13637 15 8.25C15 6.45979 14.2893 4.74243 13.0234 3.47656C11.7576 2.21069 10.0402 1.5 8.25 1.5ZM8.08398 6.7998C8.27991 6.82069 8.46829 6.88408 8.63672 6.9834L8.79883 7.09473L8.94238 7.22754C9.07608 7.37034 9.17814 7.54077 9.24121 7.72754C9.32526 7.97643 9.33583 8.24409 9.27246 8.49902L8.7373 10.6406C9.05545 10.5808 9.38789 10.7304 9.54297 11.0332C9.73159 11.4018 9.58538 11.8542 9.2168 12.043L9.18262 12.0596L9.17676 12.0635C8.94151 12.1811 8.67658 12.2291 8.41504 12.2012C8.15382 12.1732 7.90613 12.0706 7.70117 11.9062C7.49612 11.7417 7.34172 11.5216 7.25781 11.2725C7.17393 11.0232 7.16364 10.7542 7.22754 10.499L7.76172 8.3584C7.43837 8.41887 7.10252 8.264 6.95117 7.9541C6.76962 7.58193 6.92385 7.13288 7.2959 6.95117L7.33008 6.93457C7.56357 6.81934 7.82498 6.77225 8.08398 6.7998ZM8.25684 4.375C8.67097 4.37509 9.00684 4.71084 9.00684 5.125V5.13184C9.00674 5.54592 8.67092 5.88174 8.25684 5.88184H8.25C7.83584 5.88184 7.50009 5.54597 7.5 5.13184V5.125C7.5 4.71079 7.83579 4.375 8.25 4.375H8.25684Z" fill="black"/>
                    </svg>
                    <span class="trip-contact-form__info-text"><?php echo esc_html(
                        $additional_info,
                    ); ?></span>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <form class="trip-contact-form__form" id="<?php echo $form_id; ?>" novalidate>

                <div class="trip-contact-form__field trip-contact-form__field--select">
                    <label class="trip-contact-form__label" for="<?php echo $form_id; ?>-date">
                        Dostępne terminy <span aria-hidden="true">*</span>
                    </label>
                    <?php if ($has_dates): ?>
                    <select class="trip-contact-form__select"
                            id="<?php echo $form_id; ?>-date"
                            name="trip_date"
                            required
                            aria-required="true">
                        <option value="">Wybierz termin</option>
                        <?php foreach ($available_dates as $date):

                            $date_name = $date["trip_date_name"] ?? "";
                            $start = $date["trip_start_date"] ?? "";
                            $end = $date["trip_end_date"] ?? "";
                            $display = trim(
                                $start . ($end ? " - " . $end : ""),
                            );
                            ?>
                        <option value="<?php echo esc_attr(
                            $date_name,
                        ); ?>"><?php echo esc_html($display); ?></option>
                        <?php
                        endforeach; ?>
                    </select>
                    <?php else: ?>
                    <p class="trip-contact-form__no-dates">Brak dostępnych terminów</p>
                    <?php endif; ?>
                </div>
                <div class="trip-contact-form__fields-wrapper">
                    <div class="trip-contact-form__field">
                        <label class="trip-contact-form__label" for="<?php echo $form_id; ?>-name">
                            Imię i nazwisko <span aria-hidden="true">*</span>
                        </label>
                        <input class="trip-contact-form__input"
                            type="text"
                            id="<?php echo $form_id; ?>-name"
                            name="trip_name"
                            placeholder="Podaj imię i nazwisko"
                            required
                            aria-required="true">
                    </div>

                    <div class="trip-contact-form__field">
                        <label class="trip-contact-form__label" for="<?php echo $form_id; ?>-email">
                            E-mail <span aria-hidden="true">*</span>
                        </label>
                        <input class="trip-contact-form__input"
                            type="email"
                            id="<?php echo $form_id; ?>-email"
                            name="trip_email"
                            placeholder="Podaj adres e-mail"
                            required
                            aria-required="true">
                    </div>

                    <div class="trip-contact-form__field">
                        <label class="trip-contact-form__label" for="<?php echo $form_id; ?>-message">
                            Wiadomość <span aria-hidden="true">*</span>
                        </label>
                        <textarea class="trip-contact-form__textarea"
                                id="<?php echo $form_id; ?>-message"
                                name="trip_message"
                                placeholder="Wpisz treść wiadomości"
                                required
                                aria-required="true"></textarea>
                    </div>
                </div>
                <div class="trip-contact-form__field trip-contact-form__field--checkbox">
                    <div class="trip-contact-form__checkbox-wrapper">
                        <input class="trip-contact-form__checkbox"
                            type="checkbox"
                            id="<?php echo $form_id; ?>-consent"
                            name="trip_consent"
                            required
                            aria-required="true">
                        <label class="trip-contact-form__checkbox-label" for="<?php echo $form_id; ?>-consent">
                            Wyrażam zgodę na przetwarzanie moich danych osobowych przez KDC Tour sp.&nbsp;z&nbsp;o.o. w celu udzielenia odpowiedzi na przesłane zapytanie. Szczegółowe informacje na temat przetwarzania Państwa danych osobowych znajdują się w Polityce Prywatności.
                        </label>
                    </div>
                </div>

                <button class="trip-contact-form__submit<?php echo !$has_dates
                    ? " trip-contact-form__submit--disabled"
                    : ""; ?>"
                        type="submit"
                        <?php echo !$has_dates ? "disabled" : ""; ?>>
                    Wyślij wiadomość
                </button>

            </form>

            <div class="trip-contact-form__messages" aria-live="polite"></div>

        </div>
        <?php return ob_get_clean();
    }
}

/**
 * Inicjalizacja pluginu
 */
function kostaryka_trip_map_init()
{
    return Kostaryka_Trip_Map::get_instance();
}

// Uruchom plugin
add_action("plugins_loaded", "kostaryka_trip_map_init");

/**
 * Aktywacja pluginu
 */
register_activation_hook(__FILE__, "kostaryka_trip_map_activate");
function kostaryka_trip_map_activate()
{
    // Sprawdź wersję PHP
    if (version_compare(PHP_VERSION, "7.4", "<")) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die("Ten plugin wymaga PHP 7.4 lub nowszego.");
    }

    // Sprawdź wersję WordPress
    if (version_compare(get_bloginfo("version"), "5.8", "<")) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die("Ten plugin wymaga WordPress 5.8 lub nowszego.");
    }
}

/**
 * Deaktywacja pluginu
 */
register_deactivation_hook(__FILE__, "kostaryka_trip_map_deactivate");
function kostaryka_trip_map_deactivate()
{
    // Cleanup jeśli potrzebny
}
