<?php
/**
 * Plugin Name: WP Regression Tester
 * Description: Triggers regression tests after WordPress updates
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

class WP_Regression_Tester {

  public function __construct() {
    add_action('admin_menu', [$this, 'add_menu']);
    add_action('admin_post_wrt_trigger', [$this, 'handle_trigger']);
    add_action('admin_notices', [$this, 'show_notices']);
  }

  public function add_menu() {
    add_management_page(
      'Regression Tester',
      'Regression Tests',
      'manage_options',
      'wp-regression-tester',
      [$this, 'settings_page']
    );
  }

  public function settings_page() {
    $options = get_option('wrt_settings', [
      'server_url' => '',
      'secret'     => '',
      'site_key'   => '',
      'mode'       => 'manual'
    ]);

    if (isset($_POST['wrt_save_settings']) && check_admin_referer('wrt_save')) {
      $options['server_url'] = sanitize_text_field($_POST['server_url'] ?? '');
      $options['secret']     = sanitize_text_field($_POST['secret'] ?? '');
      $options['site_key']   = sanitize_text_field($_POST['site_key'] ?? '');
      $options['mode']       = sanitize_text_field($_POST['mode'] ?? 'manual');
      update_option('wrt_settings', $options);
      echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
    }

    $last_triggered = get_option('wrt_last_triggered', 'Never');
    ?>
    <div class="wrap">
      <h1>Regression Tester</h1>

      <div style="background:#fff;border:1px solid #ccd0d4;border-radius:4px;padding:24px;max-width:600px;margin-bottom:24px">
        <h2 style="margin-top:0">Trigger regression test</h2>
        <p>Click the button below after completing site updates to run automated regression tests.</p>
        <p style="color:#666;font-size:13px">Last triggered: <?php echo esc_html($last_triggered); ?></p>

        <?php if ($options['mode'] === 'manual' || empty($options['server_url'])): ?>
          <div style="background:#f0f6fc;border-left:4px solid #0073aa;padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:16px">
            <strong>Manual mode:</strong> Run the following command in your terminal after updates:<br>
            <code style="display:inline-block;margin-top:8px;padding:6px 10px;background:#1a1a1a;color:#fff;border-radius:3px">
              npm run test<?php echo !empty($options['site_key']) ? ' -- --site ' . esc_html($options['site_key']) : ''; ?>
            </code>
          </div>
        <?php else: ?>
          <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
            <?php wp_nonce_field('wrt_trigger', 'wrt_nonce'); ?>
            <input type="hidden" name="action" value="wrt_trigger">
            <button type="submit" class="button button-primary button-large"
              onclick="return confirm('This will trigger regression tests. Continue?')">
              Run regression tests now
            </button>
          </form>
        <?php endif; ?>
      </div>

      <div style="background:#fff;border:1px solid #ccd0d4;border-radius:4px;padding:24px;max-width:600px">
        <h2 style="margin-top:0">Settings</h2>
        <form method="post">
          <?php wp_nonce_field('wrt_save'); ?>

          <table class="form-table">
            <tr>
              <th>Mode</th>
              <td>
                <select name="mode">
                  <option value="manual" <?php selected($options['mode'], 'manual'); ?>>Manual (local app)</option>
                  <option value="webhook" <?php selected($options['mode'], 'webhook'); ?>>Webhook (hosted server)</option>
                </select>
              </td>
            </tr>
            <tr>
              <th>Server URL</th>
              <td>
                <input type="url" name="server_url" value="<?php echo esc_attr($options['server_url']); ?>"
                  class="regular-text" placeholder="https://your-server.com">
                <p class="description">Only needed for webhook mode</p>
              </td>
            </tr>
            <tr>
              <th>Secret key</th>
              <td>
                <input type="text" name="secret" value="<?php echo esc_attr($options['secret']); ?>"
                  class="regular-text" placeholder="Must match WP_REGRESSION_SECRET on server">
              </td>
            </tr>
            <tr>
              <th>Site key</th>
              <td>
                <input type="text" name="site_key" value="<?php echo esc_attr($options['site_key']); ?>"
                  class="regular-text" placeholder="e.g. example-woo">
                <p class="description">Matches the "key" field in your sites.json config</p>
              </td>
            </tr>
          </table>

          <p class="submit">
            <input type="submit" name="wrt_save_settings" class="button button-primary" value="Save settings">
          </p>
        </form>
      </div>
    </div>
    <?php
  }

  public function handle_trigger() {
    if (!check_admin_referer('wrt_trigger', 'wrt_nonce') || !current_user_can('manage_options')) {
      wp_die('Unauthorised');
    }

    $options = get_option('wrt_settings', []);
    $server_url = trailingslashit($options['server_url'] ?? '') . 'run';
    $secret = $options['secret'] ?? '';
    $site_key = $options['site_key'] ?? '';

    $response = wp_remote_post($server_url, [
      'body'    => json_encode(['secret' => $secret, 'site' => $site_key]),
      'headers' => ['Content-Type' => 'application/json'],
      'timeout' => 15
    ]);

    if (is_wp_error($response)) {
      set_transient('wrt_notice', ['type' => 'error', 'message' => 'Could not reach regression server: ' . $response->get_error_message()], 30);
    } else {
      update_option('wrt_last_triggered', current_time('mysql'));
      set_transient('wrt_notice', ['type' => 'success', 'message' => 'Regression tests triggered successfully. You will receive an email with results shortly.'], 30);
    }

    wp_redirect(admin_url('tools.php?page=wp-regression-tester'));
    exit;
  }

  public function show_notices() {
    $notice = get_transient('wrt_notice');
    if ($notice) {
      echo '<div class="notice notice-' . esc_attr($notice['type']) . ' is-dismissible"><p>' . esc_html($notice['message']) . '</p></div>';
      delete_transient('wrt_notice');
    }
  }
}

new WP_Regression_Tester();
