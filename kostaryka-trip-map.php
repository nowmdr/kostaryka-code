<?php
/**
 * Plugin Name: Kostaryka Code
 * Plugin URI: https://kostaryka.pl
 * Description: Interaktywna mapa lokacji dla Custom Post Type "Wyprawy" z Leaflet.js i OpenStreetMap
 * Version: 1.0.0
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
define("KOSTARYKA_TRIP_MAP_VERSION", "1.0.0");
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
     * Podłączanie skryptów i stylów
     */
    public function enqueue_scripts()
    {
        // Leaflet CSS
        wp_enqueue_style(
            "leaflet-css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            [],
            "1.9.4",
        );

        // Custom styles for Leaflet popup
        wp_add_inline_style(
            "leaflet-css",
            ".leaflet-popup-content { margin: 8px; }",
        );

        // Leaflet JS
        wp_enqueue_script(
            "leaflet-js",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
            [],
            "1.9.4",
            true,
        );

        // Nasz główny skrypt (Vanilla JS - bez jQuery)
        wp_enqueue_script(
            "kostaryka-trip-map",
            KOSTARYKA_TRIP_MAP_PLUGIN_URL . "assets/js/trip-map.js",
            ["leaflet-js"],
            KOSTARYKA_TRIP_MAP_VERSION,
            true,
        );

        // Przekazanie danych do JavaScript
        wp_localize_script("kostaryka-trip-map", "tripMapData", [
            "ajaxUrl" => admin_url("admin-ajax.php"),
            "nonce" => wp_create_nonce("trip_map_nonce"),
            "pluginUrl" => KOSTARYKA_TRIP_MAP_PLUGIN_URL,
            "version" => KOSTARYKA_TRIP_MAP_VERSION,
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
