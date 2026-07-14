# AGENTS.md — Remuk Tools Project Map

> **Untuk AI Agent**: Baca file ini PERTAMA sebelum menyentuh kode apapun.
> Ini adalah satu-satunya sumber kebenaran tentang arsitektur proyek ini.

---

## 🌐 Tentang Proyek

**Remuk Tools** adalah website kumpulan tools online gratis dengan tampilan OS:
- **Desktop (≥768px)** → Shell mirip macOS (menu bar, dock, windowed apps)
- **Mobile (<768px)** → Shell mirip iOS (status bar, home screen, slide-up apps)
- **PWA** → Bisa diinstall seperti app native di HP/laptop

**Stack**: React 18 + Vite 5 + Zustand + Framer Motion + vite-plugin-pwa  
**Deploy**: Cloudflare Pages (domain: remuk.id) + GitHub Actions (backup ke GitHub Pages)  
**Repo**: https://github.com/rezamubarock/remuk.git

---

## 📁 Struktur File (Lengkap)

```
remuk/
├── index.html                         # Entry point HTML
├── vite.config.js                     # Vite + React + PWA config, path aliases
├── package.json                       # Dependencies
│
├── public/
│   ├── manifest.json                  # PWA manifest (nama, ikon, shortcuts)
│   └── icons/
│       ├── icon.svg                   # Favicon SVG
│       ├── icon-192.png               # PWA icon 192px
│       └── icon-512.png               # PWA icon 512px
│
├── src/
│   ├── main.jsx                       # ReactDOM.createRoot, import global CSS
│   ├── App.jsx                        # Root: DeviceShell + URL shortcut handler
│   │
│   ├── core/                          # ← JANTUNG APLIKASI, jangan ubah sembarangan
│   │   ├── registry.js                # ★ DAFTAR SEMUA TOOLS — edit ini untuk tambah tool
│   │   ├── store.js                   # Zustand store: semua state window manager
│   │   └── hooks/
│   │       ├── useDevice.js           # Deteksi desktop vs mobile (breakpoint 768px)
│   │       ├── useWindowManager.js    # Hook API: openTool, closeWindow, dll
│   │       ├── useService.js          # Abstraksi backend (lazy load)
│   │       └── providers/
│   │           ├── firebase.js        # Firebase Firestore client (lazy init)
│   │           └── cloudflare.js      # Cloudflare Worker client
│   │
│   ├── shell/                         # ← TAMPILAN OS
│   │   ├── DeviceShell.jsx            # Switch desktop/mobile berdasarkan viewport
│   │   ├── Wallpaper.jsx              # Animasi solar system (CSS only)
│   │   ├── desktop/
│   │   │   ├── Desktop.jsx            # Assembles: Wallpaper + MenuBar + Dock + WindowLayer
│   │   │   ├── MenuBar.jsx            # Top bar: clock real-time, nama window aktif
│   │   │   └── Dock.jsx               # Bottom dock: icons, magnify animation, running indicator
│   │   └── mobile/
│   │       ├── Mobile.jsx             # Assembles: Wallpaper + StatusBar + HomeScreen
│   │       ├── StatusBar.jsx          # Top bar: clock, wifi, baterai
│   │       └── HomeScreen.jsx         # Grid icons + swipe + AppSheet slide-up
│   │
│   ├── components/                    # ← KOMPONEN REUSABLE
│   │   ├── Window.jsx                 # Window chrome: drag, resize 8 arah, snap, traffic lights
│   │   └── Notification.jsx           # Toast notification (Framer Motion)
│   │
│   ├── tools/                         # ← SEMUA TOOLS (1 folder = 1 tool)
│   │   ├── _template/
│   │   │   └── index.jsx              # Template kosong untuk tool baru
│   │   └── text-tools/
│   │       ├── index.jsx              # Komponen: 11 transformasi teks
│   │       └── text-tools.css         # Scoped CSS untuk tool ini
│   │
│   └── styles/
│       ├── globals.css                # CSS variables, reset, utilities (.glass, scrollbar)
│       ├── shell.css                  # Styles: menubar, dock, homescreen, status bar, dll
│       ├── window.css                 # Styles: window chrome, traffic lights, resize handles
│       ├── wallpaper.css              # CSS animation solar system
│       └── animations.css             # Notification styles + @keyframes global
│
└── .github/
    └── workflows/
        └── deploy.yml                 # GitHub Actions: auto-deploy ke GitHub Pages
```

---

## 🔑 File Kritis — Wajib Dipahami

### 1. `src/core/registry.js` — Pusat Registrasi Tools

**Ini satu-satunya file yang perlu diubah untuk menambah tool baru.**

```js
export const TOOLS = [
  {
    id: 'text-tools',           // unik, dipakai sebagai key di seluruh app
    name: 'Alat Teks',          // nama tampilan di dock & home screen
    icon: '📝',                 // emoji atau path ke gambar
    description: '...',
    category: 'produktivitas',  // dipakai untuk filter
    color: '#0A84FF',           // warna gradasi icon (dari)
    colorAlt: '#5E5CE6',        // warna gradasi icon (ke)
    component: lazy(() => import('../tools/text-tools')),  // lazy load!
    defaultSize: { width: 680, height: 540 },  // ukuran default window
    minSize: { width: 420, height: 360 },       // ukuran minimum
    resizable: true,            // bisa di-resize?
    singleton: false,           // true = hanya boleh 1 window
    services: [],               // dependensi backend (lihat Service Layer)
  },
];
```

### 2. `src/core/store.js` — Zustand State Management

Menyimpan state semua windows. Persist ke localStorage.

**State utama:**
```js
{
  windows: [         // array semua window yang terbuka
    {
      id,            // 'win-timestamp-counter'
      toolId,        // referensi ke TOOLS[].id
      title,
      icon,
      position: { x, y },
      size: { width, height },
      minSize: { width, height },
      resizable,
      minimized,     // boolean
      maximized,     // boolean
      zIndex,        // auto-managed, klik → naik
    }
  ],
  activeWindowId,    // ID window yang sedang di-fokus
  snapIndicator,     // 'left' | 'right' | null
  notifications: [], // array toast
}
```

**Actions penting:**
- `openApp(tool)` — buka tool sebagai window
- `closeWindow(id)` — tutup window
- `minimizeWindow(id)` / `restoreWindow(id)`
- `toggleMaximizeWindow(id)`
- `focusWindow(id)` — bawa ke depan (auto-increment zIndex)
- `updateWindowPosition(id, {x,y})` — dipanggil saat drag
- `updateWindowSize(id, {width,height})` — dipanggil saat resize
- `snapWindow(id, 'left'|'right')` — split screen 50/50
- `addNotification({title, message, icon, type, duration})`

### 3. `src/components/Window.jsx` — Window Manager Component

Handles semua logika window interaksi:
- **Drag**: `onMouseDown` pada titlebar → track mouse → `updateWindowPosition`
- **Resize**: 8 resize handle (`n|s|e|w|ne|nw|se|sw`) → `updateWindowSize`
- **Snap**: drag ke x < 20 atau x > width-20 → `setSnapIndicator` → `snapWindow`
- **Traffic lights**: Close (merah), Minimize (kuning), Maximize (hijau)
- **Lazy content**: Setiap tool di-render dalam `<Suspense>` dengan fallback spinner

### 4. `src/core/hooks/useService.js` — Backend Abstraction

Tools yang butuh backend tinggal deklarasi di `services[]` registry, lalu:
```js
const { call, isReady } = useService('cloudflare-worker');
const result = await call('generate-email', { domain: 'remuk.id' });
```

Service di-load secara lazy — Firebase hanya diload jika ada tool yang butuh.

---

## ➕ Cara Menambah Tool Baru

**Langkah minimal (3 menit):**

1. **Buat folder**: `src/tools/nama-tool/`
2. **Buat komponen**: `src/tools/nama-tool/index.jsx`
   - Salin dari `src/tools/_template/index.jsx`
   - Prop yang diterima: `{ windowId }` (desktop) — bisa diabaikan
3. **Daftar di registry**: Tambah object di `src/core/registry.js`

```js
// src/core/registry.js — tambah entry baru:
{
  id: 'color-picker',
  name: 'Pemilih Warna',
  icon: '🎨',
  description: 'Pilih dan konversi warna',
  category: 'desain',
  color: '#FF453A',
  colorAlt: '#FF9F0A',
  component: lazy(() => import('../tools/color-picker')),
  defaultSize: { width: 400, height: 500 },
  minSize: { width: 320, height: 400 },
  resizable: true,
  singleton: false,
  services: [],
}
```

**Tool dengan backend:**
```js
services: ['cloudflare-worker']   // atau 'firebase-firestore'
```

---

## 🎨 Design System (CSS Variables)

Semua didefinisikan di `src/styles/globals.css`. **Jangan hardcode warna/spacing!**

```css
/* Warna */
--color-bg: #020210;
--color-accent: #0A84FF;      /* biru iOS/macOS */
--color-accent-alt: #30D158;  /* hijau */
--color-danger: #FF453A;      /* merah */
--color-warn: #FFD60A;        /* kuning */

/* Surface (glassmorphism) */
--surface-glass: rgba(255,255,255,0.08);
--surface-glass-md: rgba(255,255,255,0.14);
--surface-glass-lg: rgba(255,255,255,0.22);

/* Border */
--border-subtle: rgba(255,255,255,0.10);
--border-soft: rgba(255,255,255,0.18);

/* Radius */
--radius-sm: 6px;   --radius-md: 10px;
--radius-lg: 14px;  --radius-xl: 20px;

/* Transitions */
--transition-fast: 150ms cubic-bezier(0.4,0,0.2,1);
--transition-spring: 600ms cubic-bezier(0.34,1.56,0.64,1);

/* Z-index layers */
--z-wallpaper: 0;   --z-desktop: 10;
--z-window: 100;    --z-dock: 900;
--z-menubar: 950;   --z-notification: 990;
```

---

## 🔌 Service Layer — Backend Tools

Saat tool butuh backend, tambahkan provider di `src/core/hooks/providers/`:

| Service ID | File Provider | Backend | Env Variables |
|---|---|---|---|
| `firebase-firestore` | `providers/firebase.js` | Firebase | `VITE_FIREBASE_*` |
| `cloudflare-worker` | `providers/cloudflare.js` | Cloudflare Worker | `VITE_CLOUDFLARE_WORKER_URL` |
| `vercel-api` | `providers/vercel.js` | Vercel Serverless | `VITE_VERCEL_API_URL` |

**Tambah provider baru:**
1. Buat `src/core/hooks/providers/nama-service.js`
2. Export `default { async init() { return { method1, method2 } } }`
3. Tambah entry di `serviceMap` dalam `useService.js`

---

## 📦 Path Aliases (Vite)

Gunakan alias ini, bukan relative path yang panjang:

| Alias | Resolves ke |
|---|---|
| `@` | `src/` |
| `@core` | `src/core/` |
| `@shell` | `src/shell/` |
| `@components` | `src/components/` |
| `@tools` | `src/tools/` |
| `@styles` | `src/styles/` |

```js
// ✅ Benar
import { useWindowManager } from '@core/hooks/useWindowManager';
import Window from '@components/Window';

// ❌ Hindari
import { useWindowManager } from '../../core/hooks/useWindowManager';
```

---

## 🚀 Development Commands

```bash
npm run dev      # Dev server → http://localhost:5173/
npm run build    # Build production → ./dist/
npm run preview  # Preview build lokal
```

---

## 🌍 Deployment

### Cloudflare Pages (Primary — remuk.id)
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Node version**: 20
- **Custom domain**: remuk.id + www.remuk.id
- **Env variables**: set di Cloudflare Pages dashboard

### GitHub Pages (Backup)
- Auto-deploy via `.github/workflows/deploy.yml`
- Trigger: push ke branch `main`

---

## 🔧 Environment Variables

Buat file `.env.local` di root (jangan commit!):

```env
# Firebase (untuk tool yang pakai firebase-firestore)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Cloudflare Worker (untuk tool yang pakai cloudflare-worker)
VITE_CLOUDFLARE_WORKER_URL=https://worker-name.username.workers.dev
```

Di Cloudflare Pages dashboard, set environment variables yang sama tanpa prefix `VITE_` yang nanti akan Vite expose ke browser.

---

## 📋 Konvensi Kode

- **Bahasa UI**: Bahasa Indonesia (label, placeholder, pesan error)
- **Komentar kode**: Bahasa Indonesia (opsional Inggris untuk teknis)
- **Nama file**: kebab-case (`text-tools.jsx`, `use-device.js`)
- **Nama komponen React**: PascalCase (`TextTools`, `Window`)
- **Nama CSS class**: BEM-inspired (`window__titlebar`, `dock-icon--running`)
- **Setiap tool**: folder sendiri di `src/tools/`, CSS scoped di folder yang sama

---

## 🗺️ Roadmap Tools

| Tool | Status | Services |
|---|---|---|
| Alat Teks | ✅ Done | — |
| Email Sementara | 🔜 Planned | cloudflare-worker |
| Notepad Seamless | 🔜 Planned | firebase-firestore |
| Kalkulator | 🔜 Planned | — |
| Pemilih Warna | 🔜 Planned | — |
| Konverter Unit | 🔜 Planned | — |
| QR Generator | 🔜 Planned | — |
| Password Generator | 🔜 Planned | — |

---

## ⚠️ Hal Yang Perlu Diperhatikan

1. **Jangan edit `store.js` tanpa memahami Zustand persist** — state di-serialize ke localStorage, perubahan schema bisa break state yang tersimpan
2. **`window.innerWidth`** dipakai di beberapa tempat — jangan di-SSR karena ini CSR-only app
3. **React.lazy** butuh dynamic import dengan path literal — jangan variable path
4. **CSS z-index layers** sudah terdefinisi di variables — jangan pakai angka hardcode
5. **`singleton: true`** di registry mencegah tool dibuka lebih dari sekali — berguna untuk tool yang punya state global (misal: Notepad dengan sync)
