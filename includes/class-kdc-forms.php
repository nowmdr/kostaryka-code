<?php
/**
 * Kostaryka Code - backend of the contact forms.
 *
 * - ACF fields on the options page "Ustawienia Globalne" (slug: global-settings):
 *   recipients per form, "allow sending without a date" switch, Cloudflare Turnstile keys.
 * - AJAX handlers: kdc_trip_form (single oferta) and kdc_contact_form (/kontakt/).
 * - Spam protection: honeypot, per-IP rate limit, Cloudflare Turnstile (when keys are set).
 *
 * No secrets live in this file. Turnstile keys come from the options page or, if defined,
 * from the constants KDC_TURNSTILE_SITE_KEY / KDC_TURNSTILE_SECRET_KEY in wp-config.php
 * (the constants win).
 */

if (!defined("ABSPATH")) {
    exit();
}

class Kostaryka_Forms
{
    const OPTIONS_PAGE_SLUG = "global-settings";
    const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const TURNSTILE_API_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const RATE_LIMIT_MAX = 5; // submissions per window per IP
    const RATE_LIMIT_WINDOW = 600; // seconds

    public static function init()
    {
        add_action("acf/init", [__CLASS__, "register_fields"]);
        add_action("wp_ajax_kdc_trip_form", [__CLASS__, "handle_trip_form"]);
        add_action("wp_ajax_nopriv_kdc_trip_form", [
            __CLASS__,
            "handle_trip_form",
        ]);
        add_action("wp_ajax_kdc_contact_form", [
            __CLASS__,
            "handle_contact_form",
        ]);
        add_action("wp_ajax_nopriv_kdc_contact_form", [
            __CLASS__,
            "handle_contact_form",
        ]);
    }

    /* ------------------------------------------------------------------
     * Settings (ACF options page "Ustawienia Globalne")
     * ---------------------------------------------------------------- */

    public static function register_fields()
    {
        if (!function_exists("acf_add_local_field_group")) {
            return;
        }

        $recipients = function ($key, $name, $label, $instructions) {
            return [
                "key" => $key,
                "label" => $label,
                "name" => $name,
                "type" => "repeater",
                "instructions" => $instructions,
                "layout" => "table",
                "button_label" => "Dodaj adres e-mail",
                "min" => 0,
                "sub_fields" => [
                    [
                        "key" => $key . "_email",
                        "label" => "Adres e-mail",
                        "name" => "email",
                        "type" => "email",
                        "required" => 1,
                    ],
                ],
            ];
        };

        acf_add_local_field_group([
            "key" => "group_kdc_forms",
            "title" => "Formularze (e-mail i Turnstile)",
            "fields" => [
                [
                    "key" => "field_kdc_tab_trip",
                    "label" => "Formularz wyprawy",
                    "type" => "tab",
                    "placement" => "top",
                ],
                $recipients(
                    "field_kdc_trip_recipients",
                    "kdc_trip_form_recipients",
                    "Odbiorcy wiadomości z formularza wyprawy",
                    "Na te adresy trafiają zapytania ze stron wypraw. Jeśli lista jest pusta, używany jest adres administratora WordPressa.",
                ),
                [
                    "key" => "field_kdc_trip_allow_no_date",
                    "label" => "Pozwól wysłać formularz bez wybrania terminu",
                    "name" => "kdc_trip_form_allow_no_date",
                    "type" => "true_false",
                    "instructions" =>
                        "Włączone: termin jest opcjonalny, a formularz działa także wtedy, gdy wyprawa nie ma terminów. Wyłączone: termin jest wymagany, a wyprawa bez terminów nie przyjmuje zapytań. Dopóki ustawienie nie zostanie zapisane, formularz działa jak przy włączonym.",
                    "default_value" => 1,
                    "ui" => 1,
                    "ui_on_text" => "Tak",
                    "ui_off_text" => "Nie",
                ],
                [
                    "key" => "field_kdc_tab_contact",
                    "label" => "Formularz kontaktowy",
                    "type" => "tab",
                    "placement" => "top",
                ],
                $recipients(
                    "field_kdc_contact_recipients",
                    "kdc_contact_form_recipients",
                    "Odbiorcy wiadomości z formularza kontaktowego",
                    "Na te adresy trafiają wiadomości ze strony Kontakt. Jeśli lista jest pusta, używany jest adres administratora WordPressa.",
                ),
                [
                    "key" => "field_kdc_tab_turnstile",
                    "label" => "Cloudflare Turnstile",
                    "type" => "tab",
                    "placement" => "top",
                ],
                [
                    "key" => "field_kdc_turnstile_note",
                    "label" => "",
                    "name" => "",
                    "type" => "message",
                    "message" =>
                        "Klucze utworzysz w panelu Cloudflare (Turnstile → Add widget, dodaj domenę strony). Captcha włączy się dopiero, gdy wypełnione są oba klucze. Klucz tajny można zamiast tego zdefiniować w wp-config.php jako KDC_TURNSTILE_SECRET_KEY (stała ma pierwszeństwo).",
                    "esc_html" => 1,
                ],
                [
                    "key" => "field_kdc_turnstile_site_key",
                    "label" => "Site key (klucz publiczny)",
                    "name" => "kdc_turnstile_site_key",
                    "type" => "text",
                ],
                [
                    "key" => "field_kdc_turnstile_secret_key",
                    "label" => "Secret key (klucz tajny)",
                    "name" => "kdc_turnstile_secret_key",
                    "type" => "password",
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
     * Valid recipient addresses for a repeater field; falls back to the WordPress admin e-mail.
     */
    private static function recipients($field_name)
    {
        $out = [];
        if (function_exists("get_field")) {
            $rows = get_field($field_name, "option");
            if (is_array($rows)) {
                foreach ($rows as $row) {
                    $email = sanitize_email($row["email"] ?? "");
                    if ($email && is_email($email)) {
                        $out[] = $email;
                    }
                }
            }
        }
        $out = array_values(array_unique($out));

        if (!$out) {
            $fallback = sanitize_email(get_option("admin_email"));
            if ($fallback && is_email($fallback)) {
                $out[] = $fallback;
            }
        }

        return $out;
    }

    /**
     * "Allow sending without a date" switch. Not saved yet = allowed (temporary default for testing).
     */
    public static function allow_no_date()
    {
        $value = get_option("options_kdc_trip_form_allow_no_date", null);
        if ($value === null || $value === false || $value === "") {
            return true;
        }
        return (bool) (int) $value;
    }

    private static function option_string($name)
    {
        $value = get_option("options_" . $name, "");
        return is_string($value) ? trim($value) : "";
    }

    public static function turnstile_site_key()
    {
        if (defined("KDC_TURNSTILE_SITE_KEY") && KDC_TURNSTILE_SITE_KEY) {
            return trim((string) KDC_TURNSTILE_SITE_KEY);
        }
        return self::option_string("kdc_turnstile_site_key");
    }

    private static function turnstile_secret_key()
    {
        if (defined("KDC_TURNSTILE_SECRET_KEY") && KDC_TURNSTILE_SECRET_KEY) {
            return trim((string) KDC_TURNSTILE_SECRET_KEY);
        }
        return self::option_string("kdc_turnstile_secret_key");
    }

    public static function turnstile_enabled()
    {
        return self::turnstile_site_key() !== "" &&
            self::turnstile_secret_key() !== "";
    }

    /* ------------------------------------------------------------------
     * Front-end hooks (called from the main plugin file)
     * ---------------------------------------------------------------- */

    /**
     * Localized config for the form scripts and the Turnstile loader.
     * Call after the main script "kostaryka-trip-map" is enqueued.
     */
    public static function enqueue_front($script_handle)
    {
        $turnstile = self::turnstile_enabled();

        wp_localize_script($script_handle, "kdcForms", [
            "ajaxUrl" => admin_url("admin-ajax.php"),
            "turnstileSiteKey" => $turnstile ? self::turnstile_site_key() : "",
            "messages" => [
                "success" => "Dziękujemy! Wiadomość została wysłana.",
                "error" => "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.",
                "network" => "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
                "fixFields" => "Wypełnij poprawnie wszystkie wymagane pola.",
                "captchaConfirm" => "Potwierdź, że nie jesteś robotem, aby wysłać wiadomość.",
                "captchaFailed" => "Nie udało się zweryfikować zabezpieczenia. Odśwież stronę i spróbuj ponownie.",
                "required" => "To pole jest wymagane",
            ],
        ]);

        // The widget is needed only where a form is printed.
        if ($turnstile && (is_singular("oferta") || is_page("kontakt"))) {
            wp_enqueue_script(
                "kdc-turnstile",
                self::TURNSTILE_API_URL,
                [],
                null,
                ["in_footer" => true, "strategy" => "defer"],
            );
        }
    }

    /**
     * Honeypot + Turnstile slot, printed inside every form.
     */
    public static function render_protection_fields()
    {
        $html =
            '<div class="kdc-hp" aria-hidden="true"><label>Nie wypełniaj tego pola <input type="text" name="kdc_website" tabindex="-1" autocomplete="off" value=""></label></div>';

        if (self::turnstile_enabled()) {
            $html .= '<div class="kdc-turnstile"></div>';
        }

        return $html;
    }

    /* ------------------------------------------------------------------
     * AJAX handlers
     * ---------------------------------------------------------------- */

    public static function handle_trip_form()
    {
        self::guard_request();

        $post_id = isset($_POST["post_id"]) ? absint($_POST["post_id"]) : 0;
        if (
            !$post_id ||
            get_post_type($post_id) !== "oferta" ||
            get_post_status($post_id) !== "publish"
        ) {
            self::fail("Nie znaleziono wyprawy. Odśwież stronę i spróbuj ponownie.", 400);
        }

        $errors = [];
        $name = self::clean_line($_POST["trip_name"] ?? "");
        $email = sanitize_email(wp_unslash($_POST["trip_email"] ?? ""));
        $message = self::clean_text($_POST["trip_message"] ?? "");
        $consent = !empty($_POST["trip_consent"]);
        $date_value = self::clean_line($_POST["trip_date"] ?? "");

        self::validate_common($errors, $name, $email, $message, $consent, [
            "name" => "trip_name",
            "email" => "trip_email",
            "message" => "trip_message",
            "consent" => "trip_consent",
        ]);

        // Terms: validated against the dates stored on the trip.
        $dates = function_exists("get_field")
            ? get_field("trip_available_dates", $post_id)
            : [];
        $dates = is_array($dates) ? $dates : [];
        $allow_no_date = self::allow_no_date();
        $date_label = "";

        if ($date_value !== "") {
            foreach ($dates as $row) {
                if (($row["trip_date_name"] ?? "") === $date_value) {
                    $start = $row["trip_start_date"] ?? "";
                    $end = $row["trip_end_date"] ?? "";
                    $date_label = trim($start . ($end ? " - " . $end : ""));
                    break;
                }
            }
            if ($date_label === "") {
                $errors["trip_date"] = "Wybierz jeden z dostępnych terminów.";
            }
        } elseif (!$allow_no_date) {
            $errors["trip_date"] = $dates
                ? "To pole jest wymagane"
                : "Ta wyprawa nie ma obecnie dostępnych terminów.";
        }

        if ($errors) {
            self::fail("Wypełnij poprawnie wszystkie wymagane pola.", 422, $errors);
        }

        self::verify_turnstile();

        $title = get_the_title($post_id);
        $lines = [
            "Nowe zapytanie ze strony wyprawy",
            "",
            "Wyprawa: " . $title,
            "Adres strony: " . get_permalink($post_id),
            "Termin: " . ($date_label !== "" ? $date_label : "nie wybrano"),
            "",
            "Imię i nazwisko: " . $name,
            "E-mail: " . $email,
            "",
            "Wiadomość:",
            $message,
            "",
            "Zgoda na przetwarzanie danych osobowych: tak (" .
            wp_date("Y-m-d H:i") .
            ")",
        ];

        self::send_mail(
            self::recipients("kdc_trip_form_recipients"),
            "[Kostaryka] Zapytanie o wyprawę: " . $title,
            implode("\n", $lines),
            $name,
            $email,
        );
    }

    public static function handle_contact_form()
    {
        self::guard_request();

        $errors = [];
        $name = self::clean_line($_POST["name"] ?? "");
        $email = sanitize_email(wp_unslash($_POST["email"] ?? ""));
        $message = self::clean_text($_POST["message"] ?? "");
        $consent = !empty($_POST["consent"]);

        self::validate_common($errors, $name, $email, $message, $consent, [
            "name" => "name",
            "email" => "email",
            "message" => "message",
            "consent" => "consent",
        ]);

        if ($errors) {
            self::fail("Wypełnij poprawnie wszystkie wymagane pola.", 422, $errors);
        }

        self::verify_turnstile();

        $lines = [
            "Nowa wiadomość z formularza kontaktowego",
            "",
            "Imię i nazwisko: " . $name,
            "E-mail: " . $email,
            "",
            "Wiadomość:",
            $message,
            "",
            "Zgoda na przetwarzanie danych osobowych: tak (" .
            wp_date("Y-m-d H:i") .
            ")",
        ];

        self::send_mail(
            self::recipients("kdc_contact_form_recipients"),
            "[Kostaryka] Wiadomość z formularza kontaktowego",
            implode("\n", $lines),
            $name,
            $email,
        );
    }

    /* ------------------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------------- */

    private static function clean_line($value)
    {
        return sanitize_text_field(wp_unslash($value));
    }

    private static function clean_text($value)
    {
        return sanitize_textarea_field(wp_unslash($value));
    }

    private static function validate_common(
        &$errors,
        $name,
        $email,
        $message,
        $consent,
        $names
    ) {
        $len = function ($s) {
            return function_exists("mb_strlen") ? mb_strlen($s) : strlen($s);
        };

        if ($name === "" || $len($name) < 2 || $len($name) > 120) {
            $errors[$names["name"]] =
                $name === "" ? "To pole jest wymagane" : "Podaj poprawne imię i nazwisko.";
        }
        if ($email === "" || !is_email($email) || $len($email) > 190) {
            $errors[$names["email"]] = "Podaj poprawny adres e-mail";
        }
        if ($message === "" || $len($message) < 5 || $len($message) > 5000) {
            $errors[$names["message"]] =
                $message === ""
                    ? "To pole jest wymagane"
                    : "Wiadomość musi mieć od 5 do 5000 znaków.";
        }
        if (!$consent) {
            $errors[$names["consent"]] = "To pole jest wymagane";
        }
    }

    /**
     * Method check, honeypot, per-IP rate limit.
     */
    private static function guard_request()
    {
        $method = isset($_SERVER["REQUEST_METHOD"])
            ? $_SERVER["REQUEST_METHOD"]
            : "";
        if ($method !== "POST") {
            self::fail("Nieprawidłowe żądanie.", 405);
        }

        // A bot filled the hidden field: pretend success, send nothing.
        if (!empty($_POST["kdc_website"])) {
            wp_send_json_success([
                "message" => "Dziękujemy! Wiadomość została wysłana.",
            ]);
        }

        $ip = isset($_SERVER["REMOTE_ADDR"]) ? (string) $_SERVER["REMOTE_ADDR"] : "";
        $key = "kdc_form_rl_" . md5($ip);
        $count = (int) get_transient($key);
        if ($count >= self::RATE_LIMIT_MAX) {
            self::fail(
                "Wysłano zbyt wiele wiadomości. Spróbuj ponownie za kilka minut.",
                429,
            );
        }
        set_transient($key, $count + 1, self::RATE_LIMIT_WINDOW);
    }

    /**
     * Server-side Turnstile check. Fails closed: if keys are set and the check cannot
     * be completed, nothing is sent.
     */
    private static function verify_turnstile()
    {
        if (!self::turnstile_enabled()) {
            return;
        }

        $token = isset($_POST["cf-turnstile-response"])
            ? sanitize_text_field(wp_unslash($_POST["cf-turnstile-response"]))
            : "";
        if ($token === "") {
            self::fail(
                "Potwierdź, że nie jesteś robotem, i wyślij ponownie.",
                422,
                [],
                "captcha",
            );
        }

        $response = wp_remote_post(self::TURNSTILE_VERIFY_URL, [
            "timeout" => 8,
            "body" => [
                "secret" => self::turnstile_secret_key(),
                "response" => $token,
                "remoteip" => isset($_SERVER["REMOTE_ADDR"])
                    ? (string) $_SERVER["REMOTE_ADDR"]
                    : "",
            ],
        ]);

        if (is_wp_error($response)) {
            error_log("[kostaryka-forms] Turnstile request failed: " . $response->get_error_message());
            self::fail(
                "Nie udało się zweryfikować zabezpieczenia. Spróbuj ponownie za chwilę.",
                503,
                [],
                "captcha",
            );
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body["success"])) {
            $codes = isset($body["error-codes"]) && is_array($body["error-codes"])
                ? implode(",", $body["error-codes"])
                : "unknown";
            error_log("[kostaryka-forms] Turnstile rejected the token: " . $codes);
            self::fail(
                "Weryfikacja nie powiodła się. Spróbuj ponownie.",
                422,
                [],
                "captcha",
            );
        }
    }

    private static function send_mail($to, $subject, $body, $name, $reply_email)
    {
        $headers = [
            "Content-Type: text/plain; charset=UTF-8",
            // $name and $reply_email are already sanitised (no line breaks).
            'Reply-To: "' . str_replace(['"', "\r", "\n"], "", $name) . '" <' . $reply_email . ">",
        ];

        $sent = wp_mail($to, $subject, $body, $headers);

        if (!$sent) {
            error_log("[kostaryka-forms] wp_mail() returned false for: " . $subject);
            self::fail(
                "Nie udało się wysłać wiadomości. Spróbuj ponownie później.",
                500,
            );
        }

        wp_send_json_success([
            "message" => "Dziękujemy! Wiadomość została wysłana.",
        ]);
    }

    private static function fail($message, $status = 400, $fields = [], $code = "")
    {
        wp_send_json_error(
            [
                "message" => $message,
                "fields" => (object) $fields,
                "code" => $code,
            ],
            $status,
        );
    }
}
