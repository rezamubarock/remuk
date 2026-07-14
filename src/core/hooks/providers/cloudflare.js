/**
 * Cloudflare Worker Provider
 * ─────────────────────────────────────────────────────────────
 * Set VITE_CLOUDFLARE_WORKER_URL di .env dengan URL worker kamu
 * ─────────────────────────────────────────────────────────────
 */

const WORKER_URL = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || '';

const CloudflareService = {
  async init() {
    return {
      /**
       * Panggil endpoint Cloudflare Worker
       * @param {string} endpoint - path endpoint, misal 'generate-email'
       * @param {object} body - request body (opsional)
       */
      async call(endpoint, body = null) {
        const url = `${WORKER_URL}/${endpoint}`;
        const res = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`Worker error: ${res.status}`);
        return res.json();
      },
    };
  },
};

export default CloudflareService;
