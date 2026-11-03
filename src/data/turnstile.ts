// Cloudflare Turnstile site key (public - it ships in the page). Empty = the
// signup forms show no bot check. To turn it on, in one deploy:
//   1. Cloudflare dashboard -> Turnstile -> Add widget: hostnames ravenburst.com
//      and www.ravenburst.com, mode "Managed". Paste its site key here.
//   2. npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name ravenburst-site
//      (the widget's secret key)
//   3. npm run deploy
// See functions/_lib/turnstile.js.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFyFA6cZ1aX6qD18'
