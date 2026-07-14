# Remuk Tools

> Kumpulan tools online gratis dalam tampilan OS — macOS di desktop, iOS di mobile.

🌐 **Demo**: [remuk.pages.dev](https://remuk.pages.dev) _(setelah deploy)_

---

## 🚀 Mulai Pengembangan

```bash
# Install dependencies
npm install

# Jalankan dev server
npm run dev

# Build untuk production
npm run build
```

---

## 📁 Struktur Proyek

```
src/
├── core/
│   ├── registry.js          # Daftar semua tools ← edit ini untuk tambah tool baru
│   ├── store.js             # Zustand state management
│   └── hooks/               # Custom React hooks
├── shell/
│   ├── desktop/             # macOS-like shell
│   └── mobile/              # iOS-like shell
├── components/              # Komponen reusable
├── tools/                   # Semua tools
│   └── text-tools/          # Tool: Alat Teks
└── styles/                  # CSS global
```

---

## ➕ Cara Menambah Tool Baru

1. **Buat folder**: `src/tools/nama-tool/`
2. **Buat komponen**: `src/tools/nama-tool/index.jsx`
3. **Daftarkan di registry**: `src/core/registry.js`

```js
// src/core/registry.js
{
  id: 'nama-tool',
  name: 'Nama Tool',
  icon: '🔧',
  category: 'produktivitas',
  component: lazy(() => import('../tools/nama-tool')),
  defaultSize: { width: 600, height: 480 },
  services: [],  // kosong = tidak butuh backend
}
```

Selesai! Tool langsung muncul di dock dan home screen.

---

## 🔌 Service Backends

Tools yang butuh backend tinggal deklarasikan di `services[]`:

| Service ID | Backend |
|---|---|
| `firebase-firestore` | Firebase Realtime DB |
| `cloudflare-worker` | Cloudflare Worker |
| `vercel-api` | Vercel Serverless Function |

```jsx
// Di dalam tool component:
import { useService } from '@core/hooks/useService';
const { call, isReady } = useService('cloudflare-worker');
```

---

## 📦 Stack

- **React 18** + **Vite 5**
- **Zustand** — state management
- **Framer Motion** — animasi
- **vite-plugin-pwa** — PWA installable
- **CSS Variables** — design system

---

## 🌍 Deploy

### GitHub Pages (otomatis)
Push ke `main` → GitHub Actions build & deploy otomatis.

### Cloudflare Pages
1. Connect repo di Cloudflare Pages dashboard
2. Build command: `npm run build`
3. Output dir: `dist`

### Vercel
```bash
npx vercel --prod
```
