---
name: Analisis Saham Indonesia
description: Analisis saham IDX (khususnya BMRI dan Big Four bank) untuk modal pemula Rp500.000 / 1 lot, dengan manajemen risiko, position sizing, RRR, entry, take profit, dan stop loss yang disiplin dan dapat diaudit.
---

# Analisis Saham Indonesia

Gunakan skill ini saat pengguna meminta analisis saham Indonesia, rencana trading, evaluasi posisi, atau perhitungan stop loss (SL), take profit (TP), dan ukuran posisi. Fokus utama: **BMRI, BBCA, BBRI, BBNI**, dengan asumsi modal pemula **Rp500.000 dan ukuran transaksi minimum 1 lot (100 lembar)**. Alur ini tetap berlaku untuk emiten IDX lain.

> **Aturan wajib:** setiap ide trading harus disertai **Entry, Stop Loss, Take Profit, dan Risk/Reward Ratio (RRR)** yang dihitung dari harga, bukan dikarang. Jika salah satu tidak bisa dihitung, jangan beri rekomendasi trading.

## Prinsip utama

1. **Jangan mengarang data.** Harga, volume, fundamental, berita, dan foreign flow harus berasal dari sumber yang dicek saat itu. Jika data tidak tersedia, katakan tidak tersedia dan minta data dari pengguna.
2. **Selalu beri timestamp dan sumber.** Analisis tanpa tanggal dan sumber adalah asumsi, bukan fakta.
3. **Pisahkan fakta, estimasi, dan opini.** Beri label yang jelas.
4. **Risiko dulu, target kemudian.** Tentukan invalidasi sebelum menentukan TP.
5. **Tidak ada jaminan profit.** Ini edukasi dan kerangka keputusan, bukan rekomendasi investasi.
6. **Jangan pernah menyarankan all-in, pinjaman untuk trading, atau averaging down tanpa rencana risiko.**

## 0. Aturan wajib modal pemula Rp500.000

Asumsi kerja untuk pengguna pemula:

- Modal awal: **Rp500.000** (bukan Rp500 juta).
- **1 lot IDX = 100 lembar.**
- Nilai 1 lot = harga per lembar × 100.
- Biaya transaksi (komisi, levy, PPN bila ada) harus dihitung. Jika tarif pasti belum diketahui, gunakan asumsi konservatif **0,25% per sisi** dan labeli sebagai asumsi.

Jika pengguna menyebut modal lain, gunakan angka tersebut dan ulangi semua perhitungan. Rp500.000 adalah default untuk pemula, bukan satu-satunya modal yang valid.

Sebelum menyarankan transaksi, wajib jawab lima pertanyaan ini:

1. **Terjangkau?** `Entry × 100 + biaya beli ≤ Rp500.000`.
2. **Berapa risiko 1 lot?** `(Entry − SL) × 100` untuk long.
3. **Apakah risiko masih batas?** Default pemula **0,5%–1% modal = Rp2.500–Rp5.000**. Batas absolut **2% = Rp10.000**, dan hanya boleh dipakai jika pengguna memahami serta menyetujuinya.
4. **Apakah RRR minimal 1:2?** Jika TP1 kurang dari 2R, trade tidak layak untuk pemula.
5. **Apakah masih ada kas setelah entry?** Sisakan kas untuk biaya jual dan buffer; jangan memakai seluruh Rp500.000 untuk 1 lot tanpa memperhitungkan fees.

Jika salah satu gagal, nyatakan **TIDAK LAYAK** dan jelaskan alasannya. Jangan memaksakan 1 lot hanya karena itu ukuran minimum.

### Rumus wajib (posisi long)

```text
Nilai 1 lot         = Entry × 100
Biaya beli          = Nilai 1 lot × biaya per sisi
Kas setelah entry   = Modal − Nilai 1 lot − Biaya beli
Risiko per lembar   = Entry − SL
Risiko 1 lot        = Risiko per lembar × 100
Risiko % modal      = Risiko 1 lot ÷ Modal × 100%
TP1 minimal         = Entry + 2 × (Entry − SL)
RRR TP1             = (TP1 − Entry) ÷ (Entry − SL)
RRR TP2             = (TP2 − Entry) ÷ (Entry − SL)
Jumlah lot maksimal = floor(Batas risiko ÷ Risiko 1 lot)
```

Untuk posisi short, balik arah perhitungan: `Risiko per lembar = SL − Entry` dan target berada di bawah entry.

### Contoh ilustratif Rp500.000

> Angka harga di bawah hanya contoh, bukan harga aktual BMRI/Big Four dan bukan rekomendasi.

| Item | Nilai |
|---|---:|
| Modal | Rp500.000 |
| Harga entry (contoh) | Rp4.800 |
| Stop loss (contoh) | Rp4.750 |
| Risiko per lembar | Rp50 |
| Nilai 1 lot | Rp480.000 |
| Risiko 1 lot | Rp5.000 |
| Risiko % modal | 1,0% |
| TP1 (2R) | Rp4.900 |
| TP2 (4R) | Rp5.000 |
| RRR TP1 / TP2 | 1:2 / 1:4 |
| Perkiraan biaya beli 0,25% | Rp1.200 |
| Kas tersisa setelah entry + biaya beli | Rp18.800 |
| Putusan | **LAYAK, 1 lot**, dengan catatan buffer tipis |

Contoh yang harus ditolak:

- Entry Rp5.000 dan SL Rp4.900 → risiko 1 lot Rp10.000 = **2% modal**; nilai 1 lot Rp500.000 + fees sudah melebihi modal → **TIDAK LAYAK**.
- Harga Rp9.000 → 1 lot Rp900.000 > Rp500.000 → **TIDAK TERJANGKAU**. Jangan menyarankan pembelian 1 lot.
- Entry Rp4.800 dan SL Rp4.700 → risiko 1 lot Rp10.000 = 2% modal; cari entry lebih dekat support atau lewati trade.

## 1. Klarifikasi input

Sebelum menghitung, pastikan data berikut tersedia. Jika tidak ada, tanyakan atau gunakan asumsi yang diberi label.

| Data | Keterangan |
|---|---|
| Ticker | Contoh: BMRI, BBCA.JK |
| Timeframe | Intraday, swing, atau investasi |
| Harga entry | Harga aktual atau area entry |
| Stop loss | Level invalidasi, bukan angka sembarang |
| Ukuran akun | Modal total; untuk pemula gunakan **Rp500.000** |
| Risiko per trade | Default **0,5%–1%**; absolut maksimum **2%** |
| Gaya trading | Scalping, day trading, swing, position |
| Posisi saat ini | Belum punya, sudah punya, atau ingin menambah |
| Batas konsentrasi | Maksimal alokasi per saham/sektor |

Jika pengguna hanya bertanya "beli BMRI sekarang?" tanpa data, jawab dengan kerangka analisis dan minta level entry, horizon, serta toleransi risiko. Jangan langsung memberi harga target.

## 2. Workflow analisis

### Langkah 1 — Snapshot pasar

Kumpulkan dan catat:

- Harga terakhir, perubahan harian, volume, dan nilai transaksi.
- Rentang 52 minggu, harga tertinggi/terendah terdekat.
- Kapitalisasi pasar dan likuiditas rata-rata harian.
- Waktu data diambil (WIB) dan sumbernya.
- IHSG, sektor bank, dan sentimen pasar secara umum.

Untuk saham IDX, perhatikan juga:

- Antrian bid/offer dan spread.
- Foreign net buy/sell jika tersedia.
- Status perdagangan: normal, UMA, suspensi, atau notasi khusus.
- Tick size dan aturan ARA/ARB yang berlaku. **Verifikasi aturan terbaru di IDX; jangan mengandalkan ingatan.**
- Jam perdagangan dan sesi (pra-pembukaan, sesi 1, sesi 2).

### Langkah 2 — Analisis teknikal

Urutan yang disarankan:

1. **Tren dan struktur:** higher-high/higher-low, lower-high/lower-low, atau range.
2. **Support/resistance:** gunakan swing high/low, area konsolidasi, gap, dan level psikologis.
3. **Pola candlestick:** engulfing, hammer, doji, morning/evening star, marubozu. Jelaskan konteksnya, bukan hanya nama pola.
4. **Momentum:** RSI, MACD, atau stochastic jika tersedia. Sebutkan periode indikatornya.
5. **Volume:** konfirmasi breakout, climactic volume, atau volume kering.
6. **Volatilitas:** ATR(14) untuk menentukan jarak stop yang wajar.
7. **Likuiditas:** rata-rata nilai transaksi harian; hindari posisi yang terlalu besar relatif terhadap likuiditas.

Tanyakan: apakah sinyal selaras, atau saling bertentangan? Sebutkan konflik sinyal secara eksplisit.

### Langkah 3 — Konteks fundamental dan IDX

Untuk bank Big Four, gunakan metrik berikut:

| Metrik | Yang dinilai |
|---|---|
| NIM | Efisiensi dan kualitas pendapatan bunga |
| NPL dan coverage | Kualitas aset dan bantalan provisi |
| LDR | Intensitas penyaluran kredit |
| CAR / CET1 | Kecukupan modal |
| ROE / ROA | Profitabilitas |
| CASA | Biaya dana dan kekuatan deposit |
| Pertumbuhan kredit | Momentum bisnis |
| Cost of credit | Beban risiko kredit |
| PBV / PER | Valuasi relatif |
| Dividend yield | Daya tarik income |
| Payout ratio | Keberlanjutan dividen |

Konteks makro yang relevan:

- BI Rate dan ekspektasi kebijakan moneter.
- Inflasi dan nilai tukar rupiah.
- Pertumbuhan kredit perbankan dan siklus ekonomi.
- Harga komoditas jika relevan.
- Arus modal asing dan rotasi sektor.
- Kebijakan pemerintah/regulator yang memengaruhi bank.

### Langkah 4 — Checklist khusus BMRI

Gunakan checklist ini sebagai panduan, bukan template yang harus diisi dengan angka karangan.

- **Profil bisnis:** bank BUMN terbesar dari sisi aset; kombinasi korporasi, komersial, dan ritel; anak usaha di sekuritas, asuransi, dan pembiayaan.
- **Kualitas aset:** tren NPL, coverage ratio, dan cost of credit. Cek apakah provisi cukup.
- **Profitabilitas:** NIM, ROE, ROA, dan efisiensi biaya (CIR).
- **Likuiditas dan pendanaan:** CASA, LDR, dan biaya dana.
- **Permodalan:** CAR/CET1 dan kebutuhan modal untuk pertumbuhan kredit.
- **Valuasi:** PBV dan PER dibandingkan BBCA, BBRI, BBNI, serta rata-rata sektor.
- **Dividen:** payout ratio, dividend yield, dan konsistensi historis.
- **Katalis:** hasil RUPS, dividen, kinerja kuartalan, BI Rate, rupiah, dan program pemerintah.
- **Risiko:** perlambatan kredit, kenaikan NPL, tekanan NIM, intervensi kebijakan, tata kelola BUMN, dan likuiditas pasar.
- **Teknikal:** level kunci, volume, foreign flow, dan perilaku harga di sekitar level tersebut.

Bandingkan BMRI dengan peer secara adil: ukuran bisnis, kualitas aset, profitabilitas, valuasi, likuiditas, dan risiko. Jangan menyimpulkan "lebih baik" hanya dari satu rasio.

## 3. Manajemen risiko

### Aturan dasar

- Modal acuan pemula: **Rp500.000**. Risiko default **0,5%–1% = Rp2.500–Rp5.000** per trade.
- Batas absolut **2% = Rp10.000**; hanya boleh dipakai dengan persetujuan eksplisit, bukan default.
- **1 lot = 100 lembar.** Tidak ada pembelian pecahan lot di IDX.
- Jika risiko 1 lot melebihi 2% modal, trade **TIDAK LAYAK**. Jangan mengecilkan stop loss secara artifisial hanya agar posisi muat.
- Total risiko portofolio terbuka: jaga di kisaran **4%–6%**. Dengan modal Rp500.000, praktis hanya satu posisi terbuka.
- Saham-saham Big Four sangat berkorelasi. Perlakukan BMRI, BBCA, BBRI, dan BBNI sebagai **satu klaster risiko**, bukan empat posisi independen.
- Sisakan kas untuk biaya jual, slippage, dan margin of safety.
- Gunakan order yang jelas: entry, stop loss, target, dan rencana jika gap.

### Position sizing

Untuk posisi long:

```text
Risiko maksimal    = Modal × risiko per trade
Risiko per lembar  = Entry − Stop loss
Risiko 1 lot       = Risiko per lembar × 100
Jumlah lot         = floor(Risiko maksimal ÷ Risiko 1 lot)
Nilai posisi       = Jumlah lot × 100 × Entry
Sisa kas           = Modal − Nilai posisi − biaya beli
Alokasi portofolio = Nilai posisi ÷ Modal
```

Untuk posisi short, ganti `Risiko per lembar = Stop loss − Entry`.

Aturan penting:

- Hitung ukuran posisi **dari stop loss**, bukan dari target.
- Untuk modal Rp500.000, hasil `Jumlah lot` biasanya **0 atau 1**. Jika hasilnya 0, jangan memaksakan 1 lot.
- 1 lot hanya boleh diambil jika risiko 1 lot ≤ batas yang disepakati (default **1% = Rp5.000**, absolut **2% = Rp10.000**) **dan** masih ada kas untuk fees.
- Jika nilai posisi melebihi modal atau batas alokasi, **perkecil posisi atau lewati trade**; jangan melebarkan stop loss agar posisi muat.
- Pastikan jumlah saham kelipatan 100 (1 lot IDX), lalu bulatkan ke bawah.
- Perhitungkan komisi, levy, slippage, dan spread dalam estimasi hasil bersih.

### Contoh perhitungan modal Rp500.000 (ilustratif)

> Angka di bawah hanya contoh. Bukan harga aktual BMRI/Big Four dan bukan rekomendasi.

- Modal: Rp500.000
- Entry: Rp4.800
- Stop loss: Rp4.750
- Risiko per lembar: Rp50
- Risiko 1 lot: Rp5.000 = **1,0% modal**
- Nilai 1 lot: Rp480.000
- TP1 di Rp4.900 = +Rp100 = **2R**
- TP2 di Rp5.000 = +Rp200 = **4R**
- RRR: **1:2** (TP1) dan **1:4** (TP2)
- Putusan: **LAYAK, 1 lot**, dengan catatan buffer kas tipis setelah fees.

Contoh yang harus ditolak:

- Entry Rp5.000, SL Rp4.900 → risiko 1 lot Rp10.000 = 2% modal dan nilai posisi Rp500.000 tidak menyisakan kas untuk fees → **TIDAK LAYAK**.
- Harga Rp9.000 → 1 lot Rp900.000 > Rp500.000 → **TIDAK TERJANGKAU**.
- Entry Rp4.800, SL Rp4.700 → risiko 1 lot Rp10.000 = 2% modal; cari entry lebih dekat support atau lewati trade.

Jangan mengubah stop loss hanya agar nilai posisi terlihat pas. Jika setup tidak muat di Rp500.000, jawabannya adalah **tidak mengambil trade**, bukan mengambil risiko berlebih.

## 4. Stop loss

Pilih metode yang sesuai dengan struktur pasar, lalu verifikasi dengan volatilitas.

### Metode structure-based

- Long: letakkan stop di bawah swing low terdekat atau di bawah area support yang valid.
- Short: letakkan stop di atas swing high terdekat atau di atas resistance.
- Beri buffer kecil di luar level, bukan tepat di level yang ramai.
- Jika stop terlalu jauh sehingga position size menjadi terlalu kecil, cari entry yang lebih baik atau lewati trade.

### Metode ATR-based

```text
Stop long  = Entry − (k × ATR)
Stop short = Entry + (k × ATR)
```

- `k = 1,5–2,5` tergantung timeframe dan karakter saham.
- Timeframe lebih tinggi biasanya membutuhkan `k` lebih besar.
- ATR membantu menyesuaikan stop dengan volatilitas, tetapi tetap hormati struktur harga.

### Metode percentage-based

- Gunakan hanya sebagai pengaman maksimum, misalnya tidak lebih dari 5%–8% dari entry untuk swing.
- Jangan gunakan persentase yang sama untuk semua saham tanpa melihat volatilitas.
- Untuk modal Rp500.000, aturan risiko 1 lot (maksimum Rp100 per lembar) lebih ketat dan harus diutamakan.

### Aturan stop loss

- Stop loss harus ditentukan **sebelum** entry.
- Stop loss harus berbeda dari harga entry; jarak 0 berarti tidak ada invalidasi dan setup tidak valid.
- Stop loss harus berbasis struktur (swing low/high, support/resistance) dan diverifikasi dengan ATR; bukan angka persentase sembarangan.
- **Untuk modal Rp500.000:** risiko 1 lot = jarak SL × 100. Dengan default 1% = Rp5.000, jarak SL maksimum adalah **Rp50 per lembar**. Dengan batas absolut 2% = Rp10.000, jarak maksimum **Rp100 per lembar**. Jika struktur/ATR membutuhkan jarak lebih besar dari batas yang dipilih, trade **TIDAK LAYAK** untuk 1 lot.
- Jangan memindahkan stop loss menjauh untuk menghindari kerugian.
- Jangan mengecilkan stop loss menjadi terlalu dekat hanya agar 1 lot muat; stop yang terlalu dekat akan terkena noise.
- Setelah posisi profit, stop boleh dipindahkan ke break-even atau trailing, tetapi ikuti aturan yang sudah ditetapkan.
- Waspadai gap, ARA/ARB, dan suspensi: stop loss bukan jaminan eksekusi.
- Untuk saham tidak likuid, slippage bisa jauh lebih besar dari jarak stop.

## 5. Take profit

Gunakan kombinasi logika, bukan angka bulat sembarangan.

### Metode R-multiple

```text
R = Entry − Stop loss (untuk long)
TP1 = Entry + (2R)   ← target minimum untuk pemula
TP2 = Entry + (3R)
TP3 = Entry + (4R)
```

- Minimal RRR untuk pemula: **1:2**. Jika TP1 menghasilkan kurang dari 2R, trade **TIDAK LAYAK**.
- **Dengan 1 lot, tidak ada partial exit.** 1 lot = 100 lembar dan tidak bisa dijual sebagian. Pilih satu target utama yang memberi minimal 2R, lalu jual seluruh posisi di target itu.
- Partial exit hanya mungkin jika posisi minimal 2 lot. Dengan modal Rp500.000, biasanya tidak memungkinkan; jangan menyarankan partial exit yang tidak bisa dieksekusi.
- Jika resistance terdekat hanya memberi RRR < 1:2, cari entry yang lebih dekat support, tunggu retest, atau lewati trade. Jangan menaikkan TP secara fiktif.
- Jika memilih TP2/TP3, sadari seluruh posisi tetap dijual pada satu level; jangan mengklaim sudah mengambil profit sebagian.

### Metode level teknikal

- TP1 di resistance terdekat atau area likuiditas, tetapi hanya dipakai jika memberi **minimal 2R**.
- TP2 di resistance mayor, gap fill, atau measured move.
- Partial exit hanya jika posisi minimal 2 lot. Dengan 1 lot, jual seluruh posisi di satu target.
- Setelah TP1 tercapai, pindahkan stop ke break-even hanya jika masih memegang sisa posisi (minimal 2 lot).

### Metode ATR dan trailing

```text
TP berbasis ATR = Entry + (m × ATR)
Trailing stop   = Harga tertinggi − (n × ATR)
```

- `m = 2–4`, `n = 1,5–2,5` sebagai titik awal.
- Trailing stop cocok untuk tren kuat, tetapi bisa terkena noise pada timeframe rendah.

### Rumus risk-reward dan expectancy

```text
Risk-reward ratio = (TP − Entry) ÷ (Entry − SL)
Expectancy        = (Win rate × Average win) − (Loss rate × Average loss)
```

Contoh: win rate 45%, average win 2R, average loss 1R.
Expectancy = (0,45 × 2R) − (0,55 × 1R) = 0,35R per trade. Positif, tetapi tetap bergantung pada eksekusi dan biaya.

## 6. Skenario dan psikologi pasar

Selalu sajikan tiga skenario:

1. **Bullish:** apa yang harus terjadi, level yang harus ditembus, dan target.
2. **Base case:** konsolidasi/range, area yang diperhatikan, dan rencana.
3. **Bearish:** level invalidasi, risiko penurunan, dan tindakan.

Pertimbangkan psikologi pasar:

- Apakah harga sedang mengejar berita?
- Apakah volume menunjukkan konfirmasi atau jebakan?
- Apakah posisi ramai (crowded) di satu sisi?
- Apakah ada event biner terdekat (earnings, dividen, RUPS, BI Rate)?
- Apakah pengguna sedang FOMO, revenge trading, atau overtrading?

## 7. Format output yang disarankan

Gunakan struktur ringkas berikut. **Jangan pernah mengosongkan kolom Entry, SL, TP, atau RRR tanpa penjelasan.** Jika data belum tersedia, tulis "belum bisa dihitung" dan minta data yang kurang; jangan mengarang angka.

```markdown
## Snapshot
- Ticker / timeframe / waktu data / sumber
- Harga terakhir, volume, likuiditas
- Modal acuan: Rp500.000

## Bias dan bukti
- Bullish / bearish / sideways
- 3–5 bukti utama
- Konflik sinyal (jika ada)

## Level kunci
- Support:
- Resistance:
- Invalidasi:

## Rencana trading (wajib dihitung)
| Item | Nilai |
|---|---|
| Modal | Rp500.000 |
| Harga entry | |
| Nilai 1 lot (Entry × 100) | |
| Terjangkau dengan Rp500.000? | Ya / Tidak |
| Stop loss | |
| Risiko per lembar | |
| Risiko 1 lot | |
| Risiko % modal | |
| TP1 (minimal 2R) | |
| TP2 (opsional) | |
| RRR TP1 | |
| RRR TP2 | |
| Jumlah lot | |
| Nilai posisi | |
| Perkiraan biaya | |
| Kas tersisa setelah entry | |
| Putusan | LAYAK / TIDAK LAYAK |

## Skenario
- Bullish:
- Base case:
- Bearish:

## Checklist risiko
- [ ] Data terverifikasi dan bertimestamp
- [ ] Harga, Entry, SL, dan TP berasal dari data/struktur, bukan karangan
- [ ] RRR TP1 minimal 1:2
- [ ] Risiko 1 lot ≤ 2% modal (default 0,5%–1%)
- [ ] 1 lot terjangkau dan masih ada kas untuk fees
- [ ] Stop loss berbasis struktur/ATR
- [ ] Position size sesuai risiko
- [ ] Tidak melebihi batas konsentrasi
- [ ] Event risk sudah dicek
- [ ] Biaya dan slippage diperhitungkan

## Catatan
Edukasi, bukan rekomendasi investasi. Verifikasi data dan kelola risiko.
```

## 8. Guardrails

- Jangan menulis "pasti naik", "dijamin profit", atau "target pasti tercapai".
- Jangan menyarankan ukuran posisi yang melebihi risiko yang disepakati.
- Jangan mengarang level SL/TP tanpa data harga dan struktur.
- Jangan menyarankan 1 lot jika risiko 1 lot > 2% modal, harga 1 lot > Rp500.000, atau RRR < 1:2.
- Jangan menyarankan partial exit pada posisi 1 lot; itu tidak bisa dieksekusi di IDX.
- Jangan memakai modal Rp500.000 sebagai alasan untuk all-in. Modal adalah batas risiko, bukan target eksposur.
- Jangan mencampur analisis teknikal jangka pendek dengan tesis investasi jangka panjang tanpa menjelaskan horizonnya.
- Jika data real-time tidak tersedia, katakan bahwa analisis bersifat ilustratif dan minta pengguna memberikan data terbaru.
- Selalu ingatkan bahwa stop loss bisa gagal karena gap, likuiditas, ARA/ARB, atau suspensi.
- Untuk keputusan pajak, hukum, atau produk investasi tertentu, sarankan konsultasi dengan profesional berlisensi.
