# Deploy CandleScope AI ke Vercel / Netlify

CandleScope AI adalah situs statis murni: `index.html`, `style.css`, dan `app.js`.
Tidak ada framework, database, atau server API. API key Gemini diisi oleh pengguna
di browser dan disimpan di `localStorage`/`sessionStorage`, bukan di server.

Repo ini sudah menyertakan:

- `vercel.json` — konfigurasi Vercel
- `netlify.toml` — konfigurasi Netlify
- `scripts/build-static.js` — menyalin 3 file statis ke `public/`
- `.vercelignore` — file yang tidak perlu diunggah ke Vercel
- `.gitignore` — file lokal yang tidak perlu di-commit

## 1. Siapkan GitHub

Pastikan Git sudah terpasang. Cek dengan:

```powershell
git --version
```

Jika belum ada, install [Git for Windows](https://git-scm.com/download/win) atau
gunakan GitHub Desktop.

1. Buat repository baru di https://github.com/new.
   - Nama contoh: `candlescope-ai`
   - Jangan centang "Add a README file" agar tidak konflik.
2. Buka PowerShell di folder proyek:

```powershell
cd C:\Users\Asus\Documents\Saham

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/candlescope-ai.git
git push -u origin main
```

Ganti `<username>` dengan username GitHub kamu. Jika Git meminta login, gunakan
browser atau GitHub Desktop. Jika repository sudah punya remote, gunakan
`git remote set-url origin ...` sebagai ganti `git remote add`.

> `public/` tidak ikut di-commit karena merupakan hasil build. Vercel/Netlify
> akan membuatnya otomatis dari `scripts/build-static.js`.

## 2A. Deploy ke Vercel (rekomendasi)

1. Buka https://vercel.com/new dan login dengan GitHub.
2. Pilih **Import Git Repository** → pilih repo `candlescope-ai`.
   Jika repo private, beri izin akses saat diminta.
3. Isi konfigurasi:
   - **Framework Preset:** Other
   - **Build Command:** `node scripts/build-static.js`
   - **Output Directory:** `public`
   - **Environment Variables:** kosongkan
4. Klik **Deploy**. Vercel akan menjalankan build dan memberi URL `*.vercel.app`.
5. Setiap `git push` ke branch `main` akan otomatis deploy ulang.

Jika Vercel membaca `vercel.json`, Build Command dan Output Directory sudah terisi
otomatis.

## 2B. Deploy ke Netlify

1. Buka https://app.netlify.com/start dan login dengan GitHub.
2. Pilih **Import an existing project** → GitHub → pilih repo `candlescope-ai`.
   Jika repo private, beri izin akses saat diminta.
3. Isi konfigurasi:
   - **Build command:** `node scripts/build-static.js`
   - **Publish directory:** `public`
   - **Base directory:** kosong
4. Klik **Deploy site**. Netlify akan memberi URL `*.netlify.app`.
5. Setiap `git push` ke branch produksi akan otomatis deploy ulang.

`netlify.toml` sudah berisi build command dan publish directory, jadi Netlify
biasanya mengisinya otomatis.

## 3. Setelah deploy

1. Buka URL produksi.
2. Klik tombol **API key** di header.
3. Tempel Gemini API key kamu, centang **Remember** jika mau, lalu simpan.
4. Jalankan scan chart seperti biasa.

API key disimpan di browser pengguna, bukan di Vercel/Netlify. Karena localStorage
terikat ke origin, key yang tersimpan di `localhost` tidak otomatis muncul di
domain produksi — masukkan ulang di domain tersebut.

## 4. Build lokal (opsional)

```powershell
node scripts/build-static.js
```

Hasilnya ada di `public/`. Untuk preview lokal, tetap gunakan server bawaan:

```powershell
.\start-server.bat
# atau
node server.js
```

Lalu buka http://127.0.0.1:8080/.

## 5. Troubleshooting

- **Build gagal `Missing required file`** — pastikan `index.html`, `style.css`,
  dan `app.js` ada di root repo.
- **Halaman 404 setelah deploy** — pastikan Output/Publish Directory = `public`
  dan build command dijalankan.
- **Halaman blank** — buka DevTools Console; pastikan `app.js` dan `style.css`
  tidak 404. Coba Ctrl+F5.
- **Gemini 400/403** — API key salah, project belum mengaktifkan Gemini API, atau
  key dibatasi HTTP referrer. Jika dibatasi, tambahkan domain Vercel/Netlify ke
  allowed referrers di Google Cloud Console.
- **Gemini 429** — kuota terlampaui. Model `gemini-3.5-flash-lite` punya kuota
  free tier sekitar 500 RPD; tunggu reset atau cek AI Studio.
- **Ingin custom domain** — tambahkan di dashboard Vercel/Netlify, lalu ikuti
  instruksi DNS yang diberikan.

## 6. Catatan keamanan

- Jangan pernah commit API key, `.env`, atau file rahasia. `.gitignore` sudah
  mengecualikan `.env` dan file lokal umum.
- Ini adalah aplikasi client-side. Setiap pengguna memakai API key-nya sendiri.
  Untuk aplikasi publik dengan satu key milikmu, gunakan backend proxy agar key
  tidak terekspos di browser.
