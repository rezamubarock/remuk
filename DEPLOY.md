# Tutorial Deploy Remuk Tools ke remuk.id

> **Tujuan**: Hosting **remuk.id** menggunakan **Cloudflare Pages** — gratis, CDN global, mendukung custom domain, dan bisa diperluas dengan Cloudflare Workers untuk fitur backend (tidak hanya static).

---

## Mengapa Cloudflare Pages?

| Fitur | Cloudflare Pages | GitHub Pages | Vercel (free) |
|---|---|---|---|
| Custom domain | ✅ Gratis | ✅ Gratis | ✅ Gratis |
| CDN Global | ✅ 300+ lokasi | ❌ Terbatas | ✅ |
| Deploy otomatis dari GitHub | ✅ | ✅ | ✅ |
| **Cloudflare Workers** (backend) | ✅ Bisa | ❌ | ❌ (butuh paket berbayar) |
| **KV Storage** (database) | ✅ Bisa | ❌ | ❌ |
| **Env Variables** | ✅ | ❌ | ✅ |
| Analytics | ✅ Built-in | ❌ | ✅ |

> [!IMPORTANT]
> Karena domain **remuk.id** sudah punya DNS di Cloudflare (atau perlu dipindah ke sana), ini adalah pilihan terbaik dan termudah jangka panjang.

---

## Prasyarat

- [x] Akun GitHub: **rezamubarock** (repo: `remuk`)
- [ ] Akun Cloudflare: daftar gratis di [cloudflare.com](https://cloudflare.com)
- [ ] Domain **remuk.id** sudah dimiliki

---

## BAGIAN 1 — Setup Cloudflare Pages

### Langkah 1: Daftar / Login Cloudflare

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com)
2. Daftar akun baru (gratis) atau login jika sudah punya

### Langkah 2: Buat Project Pages

1. Di sidebar kiri, klik **"Workers & Pages"**
2. Klik tombol **"Create application"**
3. Pilih tab **"Pages"**
4. Klik **"Connect to Git"**

### Langkah 3: Hubungkan GitHub

1. Klik **"Connect GitHub"**
2. Authorize Cloudflare untuk akses ke GitHub
3. Pilih akun **rezamubarock**
4. Pilih repository **remuk**
5. Klik **"Begin setup"**

### Langkah 4: Konfigurasi Build

Isi form build settings:

| Field | Value |
|---|---|
| **Project name** | `remuk` |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Node version** | `20` |

> [!NOTE]
> Untuk set Node version, scroll ke bawah ke **"Environment variables"** dan tambahkan:
> - **Variable**: `NODE_VERSION` → **Value**: `20`

### Langkah 5: Deploy Pertama

Klik **"Save and Deploy"**. Tunggu 1-3 menit.

Setelah selesai, Cloudflare akan memberikan URL sementara seperti:  
`https://remuk.pages.dev`

Cek apakah website sudah berjalan di URL tersebut.

---

## BAGIAN 2 — Custom Domain remuk.id

### Opsi A: Domain sudah di Cloudflare (mudah)

Jika **remuk.id** sudah menggunakan Cloudflare sebagai nameserver:

1. Di project Cloudflare Pages → tab **"Custom domains"**
2. Klik **"Set up a custom domain"**
3. Masukkan: `remuk.id`
4. Klik **"Continue"**
5. Cloudflare akan otomatis tambah DNS record `CNAME remuk.id → remuk.pages.dev`
6. Klik **"Activate domain"**

Ulangi untuk `www.remuk.id`.

**Selesai!** Tunggu 1-5 menit untuk propagasi DNS.

---

### Opsi B: Domain di Registrar Lain (perlu pindah nameserver)

Jika domain **remuk.id** ada di registrar seperti IDwebhost, Niagahoster, dll:

#### Langkah B1: Tambahkan Domain ke Cloudflare

1. Di Cloudflare Dashboard → klik **"Add a site"**
2. Masukkan `remuk.id`
3. Pilih plan **Free**
4. Cloudflare akan scan DNS records yang sudah ada — klik **Continue**
5. Cloudflare memberikan 2 nameserver, contoh:
   ```
   asa.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```

#### Langkah B2: Ganti Nameserver di Registrar

1. Login ke panel registrar tempat kamu beli domain
2. Cari menu **"Nameserver"** atau **"DNS"**
3. Ganti nameserver lama dengan nameserver Cloudflare di atas
4. Simpan perubahan
5. Propagasi DNS: **biasanya 24 jam**, bisa lebih cepat

#### Langkah B3: Setelah Propagasi — Hubungkan ke Pages

1. Kembali ke Cloudflare Pages → project `remuk`
2. Tab **"Custom domains"** → **"Set up a custom domain"**
3. Masukkan `remuk.id` → Activate
4. Ulangi untuk `www.remuk.id`

---

## BAGIAN 3 — Auto-Deploy dari GitHub

Setelah setup selesai, setiap kali kamu push ke branch `main`:

```bash
git add .
git commit -m "feat: tambah tool baru"
git push origin main
```

→ Cloudflare Pages otomatis build & deploy dalam **~1-2 menit**. 🎉

### Preview Deploy (Bonus)

Setiap push ke branch selain `main` akan dapat URL preview, misal:
```
https://feat-new-tool.remuk.pages.dev
```

Berguna untuk test sebelum merge ke main.

---

## BAGIAN 4 — Cloudflare Workers (Untuk Tool Backend)

> [!NOTE]
> Ini untuk tools yang butuh server-side logic, seperti **Email Sementara** (generate email), **Notepad Sync**, dll. Sifatnya "bukan static" — ini adalah serverless functions yang berjalan di edge Cloudflare.

### Contoh: Tool Email Sementara

#### Buat Worker

1. Di Cloudflare Dashboard → **Workers & Pages** → **"Create application"**
2. Pilih **"Worker"** → **"Hello World"** template
3. Nama: `remuk-temp-email`
4. Edit kode worker:

```js
// Worker: remuk-temp-email
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers untuk izinkan request dari remuk.id
    const headers = {
      'Access-Control-Allow-Origin': 'https://remuk.id',
      'Content-Type': 'application/json',
    };

    if (url.pathname === '/generate') {
      const emailId = crypto.randomUUID().slice(0, 8);
      const email = `${emailId}@tempmail.remuk.id`;
      
      // Simpan ke KV storage (lihat setup KV di bawah)
      await env.TEMP_EMAILS.put(emailId, JSON.stringify({
        email,
        inbox: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 10, // 10 menit
      }), { expirationTtl: 600 });
      
      return Response.json({ email, emailId }, { headers });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
```

5. Deploy worker
6. URL worker: `https://remuk-temp-email.username.workers.dev`

#### Hubungkan ke Tool di Frontend

Di `src/core/registry.js`, update tool email:
```js
services: ['cloudflare-worker']
```

Di `.env.local`:
```env
VITE_CLOUDFLARE_WORKER_URL=https://remuk-temp-email.username.workers.dev
```

Di Cloudflare Pages dashboard → **Settings → Environment variables** → tambah variable yang sama.

---

## BAGIAN 5 — Cloudflare KV (Database Key-Value)

Untuk tools yang butuh penyimpanan data (Notepad, dll):

1. Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Klik **"Create namespace"**
3. Nama: `REMUK_NOTES`
4. Bind ke Worker di **Settings → Variables → KV Namespace Bindings**

---

## BAGIAN 6 — Environment Variables di Cloudflare Pages

Untuk tools yang butuh API keys (Firebase, dll):

1. Cloudflare Pages → project `remuk`
2. Tab **"Settings"** → **"Environment variables"**
3. Tambah variable:

```
VITE_FIREBASE_API_KEY          = AIza...
VITE_FIREBASE_AUTH_DOMAIN      = remuk-tools.firebaseapp.com
VITE_FIREBASE_PROJECT_ID       = remuk-tools
VITE_CLOUDFLARE_WORKER_URL     = https://...
```

> [!CAUTION]
> Variabel dengan prefix `VITE_` akan di-bundle ke frontend (terlihat oleh user). Jangan masukkan secret keys di sini — hanya public keys yang aman.

---

## BAGIAN 7 — Struktur URL yang Direncanakan

```
remuk.id                    → App utama (frontend React)
remuk.id/?open=text-tools   → Langsung buka Alat Teks (PWA shortcut)
api.remuk.id                → Cloudflare Worker (backend)
api.remuk.id/temp-email     → Generate temp email
api.remuk.id/notes          → Sync notepad
```

Untuk setup `api.remuk.id`:
1. Cloudflare DNS → tambah CNAME: `api → remuk-api.username.workers.dev`
2. Worker → Settings → Custom Domains → tambah `api.remuk.id`

---

## Checklist Deploy

```
[ ] Akun Cloudflare dibuat
[ ] GitHub repo terhubung ke Cloudflare Pages
[ ] Build command: npm run build | Output dir: dist | Node: 20
[ ] Deploy pertama berhasil (cek https://remuk.pages.dev)
[ ] Domain remuk.id terhubung ke Cloudflare (nameserver diubah)
[ ] Custom domain remuk.id diaktifkan di Pages
[ ] Custom domain www.remuk.id diaktifkan di Pages
[ ] HTTPS otomatis aktif (Cloudflare handle ini)
[ ] Test buka remuk.id di browser
[ ] Test install PWA dari remuk.id
[ ] (Opsional) Cloudflare Worker setup untuk tool backend
```

---

## Tips Berguna

- **Cache purge**: Jika update tidak terlihat, di Cloudflare Pages → Deployments → "Purge cache"
- **Rollback**: Klik deployment sebelumnya → "Retry deployment" untuk rollback
- **Branch preview**: Buat branch `dev` untuk preview sebelum publish
- **Analytics**: Cloudflare Pages analytics built-in, tidak perlu Google Analytics
- **Speed**: Cloudflare otomatis minify HTML/CSS/JS dan compress dengan Brotli
