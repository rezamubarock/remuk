/**
 * Vercel Serverless API Provider
 * ─────────────────────────────────────────────────────────────
 * Set VITE_VERCEL_API_URL di .env dengan URL function kamu
 * ─────────────────────────────────────────────────────────────
 */

const API_URL = import.meta.env.VITE_VERCEL_API_URL || '';

const VercelService = {
  async init() {
    return {
      async call(endpoint, body = null) {
        const url = `${API_URL}/${endpoint}`;
        const res = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`Vercel error: ${res.status}`);
        return res.json();
      },
    };
  },
};

export default VercelService;
