import { lazy } from 'react';

/**
 * REGISTRY TOOLS — REMUK
 * ─────────────────────────────────────────────────────────────
 * Untuk menambah tool baru:
 * 1. Buat folder di src/tools/<nama-tool>/
 * 2. Buat file meta.js dan index.jsx di folder tersebut
 * 3. Tambahkan entry baru di array TOOLS di bawah
 * ─────────────────────────────────────────────────────────────
 */

export const TOOLS = [
  {
    id: 'text-tools',
    name: 'Alat Teks',
    icon: '📝',
    description: 'Ubah, format, dan analisis teks dengan mudah',
    category: 'produktivitas',
    color: '#0A84FF',      // warna latar icon (gradasi dari ini)
    colorAlt: '#5E5CE6',   // warna gradasi ke-2

    // React.lazy → tool ini hanya di-load ketika dibuka pertama kali
    component: lazy(() => import('../tools/text-tools')),

    defaultSize: { width: 680, height: 540 },
    minSize: { width: 420, height: 360 },
    resizable: true,
    singleton: false,      // false = bisa dibuka lebih dari satu kali

    // Layanan backend yang dibutuhkan tool ini (kosong = tidak butuh backend)
    services: [],
  },

  // ─── Contoh tools masa depan (uncomment saat siap) ───
  // {
  //   id: 'temp-email',
  //   name: 'Email Sementara',
  //   icon: '📧',
  //   description: 'Buat email sementara untuk registrasi',
  //   category: 'privasi',
  //   color: '#FF453A',
  //   colorAlt: '#FF6B35',
  //   component: lazy(() => import('../tools/temp-email')),
  //   defaultSize: { width: 720, height: 560 },
  //   minSize: { width: 460, height: 400 },
  //   resizable: true,
  //   singleton: true,
  //   services: ['cloudflare-worker'],
  // },
  // {
  //   id: 'notepad',
  //   name: 'Notepad',
  //   icon: '📒',
  //   description: 'Catatan real-time yang tersinkronisasi',
  //   category: 'produktivitas',
  //   color: '#FFD60A',
  //   colorAlt: '#FF9F0A',
  //   component: lazy(() => import('../tools/notepad')),
  //   defaultSize: { width: 580, height: 480 },
  //   minSize: { width: 380, height: 320 },
  //   resizable: true,
  //   singleton: false,
  //   services: ['firebase-firestore'],
  // },
  // {
  //   id: 'calculator',
  //   name: 'Kalkulator',
  //   icon: '🧮',
  //   description: 'Kalkulator saintifik',
  //   category: 'produktivitas',
  //   color: '#30D158',
  //   colorAlt: '#34C759',
  //   component: lazy(() => import('../tools/calculator')),
  //   defaultSize: { width: 320, height: 500 },
  //   minSize: { width: 280, height: 420 },
  //   resizable: false,
  //   singleton: false,
  //   services: [],
  // },
  {
    id: 'notepad',
    name: 'Notepad',
    icon: '📒',
    description: 'Catatan seamless dengan sinkronisasi realtime',
    category: 'produktivitas',
    color: '#FFD60A',
    colorAlt: '#FF9F0A',
    component: lazy(() => import('../tools/notepad')),
    defaultSize: { width: 720, height: 500 },
    minSize: { width: 480, height: 380 },
    resizable: true,
    singleton: true,
    services: ['firebase-firestore'],
  },
  {
    id: 'settings',
    name: 'Pengaturan',
    icon: '⚙️',
    description: 'Konfigurasi desktop shell, wallpaper, dan peletakan aplikasi',
    category: 'sistem',
    color: '#8E8E93',
    colorAlt: '#AEAEB2',
    component: lazy(() => import('../tools/settings')),
    defaultSize: { width: 520, height: 450 },
    minSize: { width: 400, height: 350 },
    resizable: false,
    singleton: true,
    services: [],
  },
  {
    id: 'system-info',
    name: 'Sistem & Sensor',
    icon: '🖥️',
    description: 'Spesifikasi hardware, Geo-IP, GPU, dan Task Manager monitor',
    category: 'sistem',
    color: '#30D158',
    colorAlt: '#34C759',
    component: lazy(() => import('../tools/system-info')),
    defaultSize: { width: 780, height: 500 },
    minSize: { width: 480, height: 380 },
    resizable: true,
    singleton: true,
    services: [],
  },
  {
    id: 'azera-drop',
    name: 'AzeraDrop',
    icon: '📡',
    description: 'Berbagi berkas secara instan dan aman dengan sesama pengguna di Wi-Fi yang sama',
    category: 'produktivitas',
    color: '#0A84FF',
    colorAlt: '#30B0FF',
    component: lazy(() => import('../tools/azera-drop')),
    defaultSize: { width: 700, height: 480 },
    minSize: { width: 500, height: 420 },
    resizable: true,
    singleton: true,
    services: ['firebase-firestore'],
  },
  {
    id: 'redraw',
    name: 'ReDraw',
    icon: '🎨',
    description: 'Kanvas coretan kolaboratif real-time yang tersinkronisasi di jaringan yang sama',
    category: 'desain',
    color: '#BF5AF2',
    colorAlt: '#FF375F',
    component: lazy(() => import('../tools/redraw')),
    defaultSize: { width: 760, height: 520 },
    minSize: { width: 480, height: 400 },
    resizable: true,
    singleton: true,
    services: ['firebase-firestore'],
  },
];

/**
 * Ambil tool berdasarkan ID
 * @param {string} id
 * @returns {object|undefined}
 */
export const getToolById = (id) => TOOLS.find((t) => t.id === id);

/**
 * Ambil tools berdasarkan kategori
 * @param {string} category
 * @returns {object[]}
 */
export const getToolsByCategory = (category) =>
  category ? TOOLS.filter((t) => t.category === category) : TOOLS;

/**
 * Daftar kategori unik
 */
export const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];
