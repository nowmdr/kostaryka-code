<?php
/**
 * Kostaryka Code - cookie consent (Google Analytics 4 only after the visitor agrees).
 *
 * - The measurement ID comes from the ACF options page "Ustawienia Globalne" (field
 *   kdc_ga_measurement_id) or, if defined, from the constant KDC_GA_MEASUREMENT_ID in
 *   wp-config.php (the constant wins). No ID = no analytics. The banner is then shown only
 *   while the switch "Pokaż baner także bez ID" is on (temporary default: on, so the look
 *   can be checked before Google Analytics exists; the buttons only save the choice).
 * - This file only prints the banner markup and loads dist/consent.js + dist/consent.css.
 *   The script itself decides: nothing from Google is requested before "Akceptuję".
 * - The banner is printed on every front-end page (not only where main.js is loaded).
 *
 * No secrets live here: a GA measurement ID is public by design.
 */

if (!defined("ABSPATH")) {
    exit();
}

class Kostaryka_Consent
{
    const OPTIONS_PAGE_SLUG = "global-settings";
    const DEFAULT_POLICY_PATH = "/polityka-prywatnosci/";
    const DEFAULT_TITLE = "Pliki cookies";
    const DEFAULT_TEXT = "Za Twoją zgodą włączymy Google Analytics, aby sprawdzać, jak korzystasz ze strony, i ją ulepszać. Bez zgody nie zbieramy tych danych, a strona działa tak samo. Wybór możesz zmienić w każdej chwili.";

    public static function init()
    {
        add_action("acf/init", [__CLASS__, "register_fields"]);
        add_action("wp_enqueue_scripts", [__CLASS__, "enqueue"], 20);
        add_action("wp_footer", [__CLASS__, "render_banner"], 5);
        add_shortcode("kdc_cookie_settings", [__CLASS__, "shortcode_settings"]);
    }

    /* ------------------------------------------------------------------
     * Settings
     * ---------------------------------------------------------------- */

    public static function register_fields()
    {
        if (!function_exists("acf_add_local_field_group")) {
            return;
        }

        acf_add_local_field_group([
            "key" => "group_kdc_consent",
            "title" => "Cookies i analityka",
            "fields" => [
                [
                    "key" => "field_kdc_consent_note",
                    "label" => "",
                    "name" => "",
                    "type" => "message",
                    "message" =>
                        "Google Analytics uruchamia się dopiero po kliknięciu \"Akceptuję\" w banerze cookies. Dopóki pole z ID jest puste, analityka jest wyłączona, a baner wyświetla się tylko przy włączonym przełączniku poniżej. ID można zamiast tego zdefiniować w wp-config.php jako KDC_GA_MEASUREMENT_ID (stała ma pierwszeństwo).",
                    "esc_html" => 1,
                ],
                [
                    "key" => "field_kdc_consent_title",
                    "label" => "Nagłówek baneru",
                    "name" => "kdc_consent_title",
                    "type" => "text",
                    "instructions" =>
                        "Pole puste: używany jest tekst domyślny.",
                    "placeholder" => self::DEFAULT_TITLE,
                ],
                [
                    "key" => "field_kdc_consent_text",
                    "label" => "Tekst baneru (przed linkiem do polityki prywatności)",
                    "name" => "kdc_consent_text",
                    "type" => "textarea",
                    "rows" => 4,
                    "new_lines" => "",
                    "instructions" =>
                        "Zwykły tekst, bez formatowania. Link \"Polityka prywatności\" dodawany jest automatycznie po tym tekście. Pole puste: używany jest tekst domyślny.",
                    "placeholder" => self::DEFAULT_TEXT,
                ],
                [
                    "key" => "field_kdc_consent_preview",
                    "label" => "Pokaż baner także bez ID Google Analytics",
                    "name" => "kdc_consent_banner_without_id",
                    "type" => "true_false",
                    "instructions" =>
                        "Włączone: baner cookies wyświetla się, nawet gdy ID Google Analytics jest puste (do sprawdzenia wyglądu; przyciski tylko zapamiętują wybór). Wyłączone: bez ID baner się nie wyświetla. Dopóki ustawienie nie zostanie zapisane, baner jest pokazywany jak przy włączonym.",
                    "default_value" => 1,
                    "ui" => 1,
                    "ui_on_text" => "Tak",
                    "ui_off_text" => "Nie",
                ],
                [
                    "key" => "field_kdc_ga_measurement_id",
                    "label" => "ID pomiaru Google Analytics 4",
                    "name" => "kdc_ga_measurement_id",
                    "type" => "text",
                    "instructions" =>
                        "Format: G-XXXXXXXXXX (Google Analytics → Administracja → Strumienie danych).",
                    "placeholder" => "G-XXXXXXXXXX",
                ],
            ],
            "location" => [
                [
                    [
                        "param" => "options_page",
                        "operator" => "==",
                        "value" => self::OPTIONS_PAGE_SLUG,
                    ],
                ],
            ],
            "position" => "normal",
            "style" => "default",
            "label_placement" => "top",
        ]);
    }

    /**
     * GA4 measurement ID or an empty string. Only the form G-XXXXXXXX is accepted.
     */
    public static function ga_id()
    {
        $id =
            defined("KDC_GA_MEASUREMENT_ID") && KDC_GA_MEASUREMENT_ID
                ? KDC_GA_MEASUREMENT_ID
                : get_option("options_kdc_ga_measurement_id", "");

        $id = strtoupper(trim((string) $id));

        return preg_match("/^G-[A-Z0-9]{4,20}$/", $id) ? $id : "";
    }

    /**
     * The banner is needed only when something non-essential can run, on the public site.
     */
    public static function enabled()
    {
        if (is_admin() || is_feed() || is_robots() || wp_doing_ajax()) {
            return false;
        }
        if (function_exists("is_customize_preview") && is_customize_preview()) {
            return false;
        }
        // Breakdance visual editor (iframe) - no banner while editing
        if (isset($_GET["breakdance"]) || isset($_GET["breakdance_iframe"])) {
            return false;
        }

        return (bool) apply_filters(
            "kdc_consent_enabled",
            self::ga_id() !== "" || self::banner_without_id(),
        );
    }

    /**
     * "Show the banner without a GA ID" switch. Not saved yet = on (temporary default for the look check).
     */
    public static function banner_without_id()
    {
        $value = get_option("options_kdc_consent_banner_without_id", null);
        if ($value === null || $value === false || $value === "") {
            return true;
        }
        return (bool) (int) $value;
    }

    /**
     * Banner heading / text from the options page; the default when the field is empty.
     */
    private static function text_option($name, $default)
    {
        $value = trim(wp_strip_all_tags((string) get_option("options_" . $name, "")));

        return $value !== "" ? $value : $default;
    }

    public static function title()
    {
        return self::text_option("kdc_consent_title", self::DEFAULT_TITLE);
    }

    public static function text()
    {
        return self::text_option("kdc_consent_text", self::DEFAULT_TEXT);
    }

    public static function policy_url()
    {
        $url = function_exists("get_privacy_policy_url")
            ? get_privacy_policy_url()
            : "";
        if (!$url) {
            $url = home_url(self::DEFAULT_POLICY_PATH);
        }

        return apply_filters("kdc_consent_policy_url", $url);
    }

    /* ------------------------------------------------------------------
     * Front end
     * ---------------------------------------------------------------- */

    private static function asset_version($relative_path)
    {
        $file = KOSTARYKA_TRIP_MAP_PLUGIN_DIR . $relative_path;

        return file_exists($file)
            ? KOSTARYKA_TRIP_MAP_VERSION . "." . filemtime($file)
            : KOSTARYKA_TRIP_MAP_VERSION;
    }

    public static function enqueue()
    {
        if (!self::enabled()) {
            return;
        }

        wp_enqueue_style(
            "kdc-consent",
            KOSTARYKA_TRIP_MAP_PLUGIN_URL . "dist/consent.css",
            [],
            self::asset_version("dist/consent.css"),
        );

        wp_enqueue_script(
            "kdc-consent",
            KOSTARYKA_TRIP_MAP_PLUGIN_URL . "dist/consent.js",
            [],
            self::asset_version("dist/consent.js"),
            ["in_footer" => true, "strategy" => "defer"],
        );
    }

    public static function render_banner()
    {
        if (!self::enabled()) {
            return;
        }
        ?>
        <div id="kdc-cookie-banner" class="kdc-cookie" role="region" aria-label="Zgoda na pliki cookies" data-ga-id="<?php echo esc_attr(self::ga_id()); ?>" hidden>
            <div class="kdc-cookie__text">
                <p class="kdc-cookie__title"><?php echo esc_html(self::title()); ?></p>
                <p class="kdc-cookie__desc">
                    <?php echo esc_html(self::text()); ?>
                    <a class="kdc-cookie__link" href="<?php echo esc_url(self::policy_url()); ?>">Polityka prywatności</a>
                </p>
                <p class="kdc-cookie__status" data-kdc-status data-text-granted="Aktualny wybór: zgoda udzielona." data-text-denied="Aktualny wybór: brak zgody." hidden></p>
            </div>
            <div class="kdc-cookie__actions">
                <button type="button" class="kdc-cookie__btn kdc-cookie__btn--deny" data-kdc-consent="deny">Odrzucam</button>
                <button type="button" class="kdc-cookie__btn kdc-cookie__btn--accept" data-kdc-consent="accept">Akceptuję</button>
            </div>
        </div>
        <?php
    }

    /**
     * [kdc_cookie_settings label="Ustawienia cookies"] - a button that reopens the banner.
     * A plain link with href="#cookie-settings" (e.g. in the Breakdance footer) works too.
     */
    public static function shortcode_settings($atts)
    {
        $atts = shortcode_atts(
            ["label" => "Ustawienia cookies"],
            $atts,
            "kdc_cookie_settings",
        );

        return '<button type="button" class="kdc-cookie-settings" data-kdc-cookie-settings>' .
            esc_html($atts["label"]) .
            "</button>";
    }
}
