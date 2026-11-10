# CandleScope AI

Aplikasi web statis untuk menganalisis screenshot chart candlestick dengan **Gemini 3.5 Flash-Lite**. Hasil analisis mencakup pola candlestick, support/resistance, sentimen, confidence, dan rencana trading (entry, stop loss, take profit, risk/reward).

## Struktur

| File | Fungsi |
|---|---|
| `index.html` | Markup aplikasi |
| `style.css` | Styling |
| `app.js` | Logika scan, Gemini API, riwayat, dan advisor chat |
| `server.js` | Server statis lokal (Node built-in, tanpa dependency) |
| `scripts/build-static.js` | Menyalin 3 file statis ke `public/` untuk deploy |
| `vercel.json` | Konfigurasi deploy Vercel |
| `netlify.toml` | Konfigurasi deploy Netlify |

## Jalankan lokal

```powershell
.\start-server.bat
```

atau:

```powershell
node server.js
```

Buka http://127.0.0.1:8080/, klik **API key**, lalu masukkan Gemini API key.

## Deploy

Panduan lengkap: [DEPLOY.md](DEPLOY.md).

## API key

API key diisi pengguna di browser dan disimpan di `localStorage`/`sessionStorage`. Key tidak disimpan di repo dan tidak dikirim ke server proyek ini; request analisis dikirim langsung dari browser ke Gemini API.

## Build output

```powershell
node scripts/build-static.js
```

Perintah ini membuat `public/` berisi `index.html`, `style.css`, dan `app.js`. Folder `public/` di-ignore oleh Git dan dibuat otomatis oleh Vercel/Netlify saat deploy.
