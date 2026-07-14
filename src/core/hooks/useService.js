/**
 * Service abstraction layer — Remuk
 * ─────────────────────────────────────────────────────────────
 * Tools bisa mendeklarasikan service yang mereka butuhkan di registry.
 * Hook ini menyediakan akses ke service tersebut.
 *
 * Cara pakai di dalam tool:
 *   const { call, isReady } = useService('cloudflare-worker');
 *   const result = await call('endpoint-name', { param: 'value' });
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';

// Lazy service instances (init saat pertama dibutuhkan)
const serviceInstances = {};

/**
 * Load service module secara lazy
 * @param {string} serviceId
 */
const loadService = async (serviceId) => {
  if (serviceInstances[serviceId]) return serviceInstances[serviceId];

  const serviceMap = {
    'firebase-firestore': () => import('./providers/firebase.js'),
    'cloudflare-worker': () => import('./providers/cloudflare.js'),
    'vercel-api': () => import('./providers/vercel.js'),
  };

  const loader = serviceMap[serviceId];
  if (!loader) {
    throw new Error(`[Remuk] Service tidak dikenal: "${serviceId}"`);
  }

  const module = await loader();
  const instance = await module.default.init();
  serviceInstances[serviceId] = instance;
  return instance;
};

/**
 * Hook untuk mengakses layanan backend
 * @param {string} serviceId - ID service: 'firebase-firestore' | 'cloudflare-worker' | 'vercel-api'
 */
export const useService = (serviceId) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const serviceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadService(serviceId)
      .then((svc) => {
        if (!cancelled) {
          serviceRef.current = svc;
          setIsReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          console.error(`[Remuk] Gagal load service "${serviceId}":`, err);
        }
      });
    return () => { cancelled = true; };
  }, [serviceId]);

  const call = async (method, ...args) => {
    if (!serviceRef.current) throw new Error(`Service "${serviceId}" belum siap`);
    return serviceRef.current[method]?.(...args);
  };

  return { isReady, error, call, service: serviceRef.current };
};
