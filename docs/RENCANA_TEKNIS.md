# Rencana Teknis: Aplikasi Les Gitar Klasik

> Nama aplikasi: **Harmoni Gitar**. Dokumen ini adalah pegangan untuk membangun aplikasi dengan Claude Code. Simpan di root repo baru (atau rujuk dari `CLAUDE.md`).

## 1. Tujuan dan keputusan yang sudah diambil

Aplikasi web untuk **siswa les gitar klasik Pak Rangga** agar bisa berlatih mandiri dan teratur di rumah, mengikuti kurikulum *Modul Latihan Gitar Klasik* (4 unit: Dasar-dasar, Teknik 1, Etude 1, Lagu).

| Keputusan | Isi |
|---|---|
| Hubungan dengan LMS Harmoni | **Aplikasi terpisah** (repo, database, dan domain sendiri), memakai stack dan pola kode yang sama. |
| Siapa yang bisa masuk | **Hanya yang diizinkan guru.** Tidak ada formulir pendaftaran terbuka. |
| Pendaftaran | Utama: **link/kode undangan sekali pakai** (dikirim lewat WhatsApp). Cadangan: **guru membuat akun langsung** (username + kata sandi awal). |
| Peran | **Guru (admin) dan siswa.** Akun orang tua ditunda (lihat bagian 11). |
| Les privat | Jadwal & absensi pertemuan, catatan guru per pertemuan, tugas latihan per siswa, status siswa aktif/nonaktif. |
| Pembayaran iuran | **Tabel disiapkan sejak awal, fitur dimatikan** (feature flag) sampai diputuskan dipakai. |

## 2. Stack (sama dengan LMS Harmoni)

- **Next.js 16 (App Router) + React 19 + TypeScript.** Perhatikan `AGENTS.md` di Harmoni: versi Next ini punya perubahan besar; baca dokumen di `node_modules/next/dist/docs/` sebelum menulis kode.
- **Tailwind CSS 4**, komponen UI gaya Harmoni (`class-variance-authority`, `lucide-react`, `sonner`, `next-themes`), prioritas tampilan HP.
- **PostgreSQL 17 + Drizzle ORM** (`drizzle-kit` untuk migrasi).
- **Better Auth** dengan plugin `username` dan `admin` (pola persis seperti Harmoni: `admin.createUser` untuk akun buatan guru tanpa berpindah sesi).
- **Penyimpanan file**: lokal (`UPLOAD_DIR`) atau S3, salin `src/lib/storage.ts` dari Harmoni.
- **i18n Indonesia/Inggris**: salin pola `src/i18n` dari Harmoni (bawaan: Indonesia).
- **Audio**: Web Audio API langsung untuk metronom dan bunyi timer (`src/lib/audio.ts`); `tone` tidak dipakai agar ringan dan bisa offline.
- **Baru:**
  - **alphaTab** (`@coderline/alphatab`): menampilkan notasi balok + tab gitar dari MusicXML, memutar suara, kursor mengikuti not, ubah tempo.
  - **Deteksi nada untuk tuner**: Web Audio API + library kecil seperti `pitchy`.
- **Deploy**: untuk sementara **localhost dengan Docker Compose**, seperti Harmoni (`db` PostgreSQL + `app`). Caddy, domain, dan VPS disiapkan nanti saat aplikasi siap dipakai siswa dari luar. Agar bisa berjalan bersamaan dengan LMS Harmoni di komputer yang sama, pakai port berbeda: app `3001` (Harmoni `3000`), PostgreSQL `5433` (Harmoni `5432`).

### Yang disalin dari LMS Harmoni lalu disesuaikan

| Dari Harmoni | Dipakai untuk |
|---|---|
| `src/lib/auth.ts`, `session.ts`, `access.ts`, `password.ts`, `username.ts` | Login, sesi, cek peran |
| `src/lib/invite-code.ts` | Dasar pembuat kode undangan (diubah: kode per orang, bukan per kelas) |
| `src/components/metronome.tsx`, `src/lib/audio.ts` | Metronom |
| `src/components/recorder.tsx`, `free-recorder.tsx`, tabel `recording` | Rekam permainan siswa |
| `teacherSchedule`, `classSession`, `attendanceRecord` | Pola jadwal & absensi (diubah: per siswa, bukan per kelas) |
| `appSetting` (key–value JSON) | Feature flag, termasuk pembayaran |
| `app-shell.tsx`, `nav-links.tsx`, `components/ui/*`, `brand.tsx` | Kerangka tampilan |
| `scripts/db-migrate.ts`, `seed.ts`, `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `backup.sh`, `deploy.sh` | Infrastruktur |

Tidak perlu dibawa: fitur AI perangkat ajar, kalender akademik, kuis MIDI piano, piano roll, ear training (bisa menyusul jika dibutuhkan).

## 3. Peran dan hak akses

| Peran | Bisa | Tidak bisa |
|---|---|---|
| **Guru** (`teacher`, admin) | Semua: membuat undangan & akun, mengelola kurikulum, tugas, jadwal, absensi, penilaian, pengaturan, pembayaran (jika aktif) | — |
| **Siswa** (`student`) | Membuka pelajaran yang sudah terbuka, latihan (notasi, metronom, timer, tuner), mengisi checklist & cek unit, merekam & mengirim tugas, melihat jurnal, jadwal, dan nilainya sendiri | Melihat data siswa lain; membuka unit yang masih terkunci |

- Satu guru utama. Struktur tetap memakai `teacherId` di tabel-tabel penting agar kelak bisa menambah guru asisten.
- Semua pemeriksaan hak akses dilakukan di server (server action / route handler), bukan hanya disembunyikan di tampilan.

## 4. Alur akun

### 4.1 Akun guru pertama
- Tidak ada pendaftaran publik. Akun guru dibuat lewat skrip `npm run setup:teacher` (membaca nama, email, kata sandi dari argumen/env), atau lewat kode rahasia `TEACHER_SETUP_CODE` yang hanya berlaku selama belum ada guru.

### 4.2 Undangan (jalur utama)
1. Guru membuka **Siswa → Undang**, mengisi nama calon siswa.
2. Server membuat baris `invitation` dengan token acak (32 byte), menyimpan **hash**-nya saja, berlaku 7 hari (bisa diatur).
3. Guru mendapat link `https://<domain>/undangan/<token>` + tombol **Salin** dan **Kirim lewat WhatsApp** (`https://wa.me/?text=...`).
4. Calon siswa membuka link → mengisi nama, username (atau email), kata sandi → akun dibuat dengan peran sesuai undangan → undangan ditandai terpakai → langsung masuk.
5. Undangan bisa dibatalkan guru; yang kedaluwarsa atau sudah terpakai menampilkan pesan jelas.

Catatan selama masih di localhost: link undangan (dan aplikasinya) hanya bisa dibuka dari komputer guru atau perangkat di jaringan Wi-Fi yang sama (lewat IP lokal komputer guru). Basis URL link diambil dari `BETTER_AUTH_URL`, jadi cukup diubah saat pindah ke domain.

### 4.3 Guru membuat akun langsung (cadangan)
- Form: nama, username, kata sandi awal → `admin.createUser`. Siswa diminta mengganti kata sandi saat pertama masuk (`mustChangePassword`).

### 4.4 Pendaftaran publik
- Pendaftaran Better Auth **ditolak** kecuali datang dari alur undangan atau dari guru: tolak di `databaseHooks.user.create.before` bila tidak ada konteks undangan/guru (perluas pola `signupContext` di `src/lib/auth.ts` Harmoni, yang sekarang dipakai untuk menentukan peran). Tes wajib: memanggil endpoint sign-up langsung harus gagal.

### 4.5 Status siswa
- `aktif` / `nonaktif`. **Siswa nonaktif sama sekali tidak bisa masuk**: set `banned = true` lewat plugin `admin` Better Auth dan cabut semua sesinya. Siswa nonaktif tidak muncul di jadwal dan tugas. Data tidak dihapus; mengaktifkan kembali (`banned = false`) memulihkan semuanya.

## 5. Struktur database

Nama tabel bahasa Inggris (seperti Harmoni), label tampilan bahasa Indonesia. Semua tabel punya `createdAt`/`updatedAt` kecuali disebut lain.

### 5.1 Akun & orang
| Tabel | Kolom penting |
|---|---|
| `user`, `session`, `account`, `verification` | Struktur Better Auth (salin dari Harmoni). `role` enum: `teacher`, `student`. `isAdmin`, `username`, `banned` (dipakai untuk menonaktifkan login). |
| `student_profile` | `userId` (PK/FK), `teacherId`, `status` (`active`/`inactive`), `level` / unit saat ini, `startedAt`, `birthYear` (opsional), `guitarNotes` (mis. ukuran gitar), `teacherNotes` (catatan pribadi guru), `routineSegments` (jsonb, opsional: durasi timer khusus siswa ini; kosong = pakai default) |
| `invitation` | `id`, `tokenHash`, `role`, `name`, `createdBy`, `expiresAt`, `usedAt`, `usedBy`, `revokedAt` |

### 5.2 Kurikulum (dari modul)
| Tabel | Kolom penting |
|---|---|
| `unit` | `id`, `order`, `slug`, `title` (Dasar-dasar, Teknik 1, Etude 1, Lagu), `color`, `description` |
| `lesson` | `id`, `unitId`, `order`, `slug`, `title`, `summary`, `kind` (`theory`/`technique`/`etude`/`piece`/`check`), `estimatedMinutes`, `published` |
| `lesson_block` | `id`, `lessonId`, `order`, `type` (`text`, `image`, `video`, `score`, `checklist`, `quiz`, `tip`, `focus`, `target`), `data` (jsonb, isi tergantung `type`) |
| `piece` | Karya/latihan musik: `id`, `title`, `composer`, `musicXmlFileKey`, `defaultBpm`, `stageBpm` (jsonb: tahap 1/2/3), `timeSignature`, `copyrightStatus` (`public_domain`/`own_work`/`licensed`/`unknown`), `sourceNote` |
| `unit_check_item` | Butir "Cek Unit" (mis. 12 kemampuan Unit 1): `unitId`, `order`, `text` |

Catatan: konten modul dimasukkan lewat **skrip seed dari file JSON/Markdown di repo** (`content/units/*.json`), sehingga kurikulum bisa direvisi lewat Git. Editor kurikulum di dashboard guru bisa menyusul.

### 5.3 Kemajuan siswa
| Tabel | Kolom penting |
|---|---|
| `lesson_progress` | `studentId`, `lessonId`, `status` (`locked`/`open`/`done`), `openedAt`, `doneAt`; unik (studentId, lessonId) |
| `checklist_state` | `studentId`, `lessonBlockId`, `checkedItems` (jsonb) |
| `piece_progress` | `studentId`, `pieceId`, `stage` (0–3: Pelan, Sedang, Tempo asli), `bestBpm`, `stageDates` (jsonb), `teacherVerified` (bool) |
| `unit_check` | `studentId`, `unitCheckItemId`, `selfLevel` (`belum`/`hampir`/`sudah`), `teacherLevel`, `updatedAt` |
| `unit_unlock` | `studentId`, `unitId`, `unlockedAt`, `unlockedBy` (guru bisa membuka manual) |

Aturan pembuka bertahap: pelajaran berikutnya terbuka setelah yang sebelumnya `done`; unit berikutnya terbuka setelah **guru menyetujui** Cek Unit (atau guru membuka manual).

### 5.4 Latihan & jurnal
| Tabel | Kolom penting |
|---|---|
| `practice_session` | `id`, `studentId`, `startedAt`, `endedAt`, `totalSeconds`, `segments` (jsonb: menit pemanasan/teknik/etude/lagu), `pieceIds`, `maxBpm` (jsonb per piece), `mood`/`difficulty` (1–5, opsional), `studentNote` |

Jurnal = daftar `practice_session`. Streak dan pelacak mingguan **dihitung dari tabel ini** (tidak disimpan terpisah).

### 5.5 Tugas, rekaman, penilaian
| Tabel | Kolom penting |
|---|---|
| `assignment` | `id`, `teacherId`, `studentId`, `lessonId` / `pieceId`, `targetStage`, `targetBpm`, `instructions`, `dueDate`, `status` (`assigned`/`submitted`/`reviewed`/`done`) |
| `recording` | `id`, `studentId`, `assignmentId` (opsional), `pieceId` (opsional), `fileKey`, `mimeType`, `durationSeconds`, `note` |
| `review` | `id`, `recordingId`, `teacherId`, `posture`, `accuracy`, `rhythm`, `technique`, `expression` (masing-masing 1–4, sesuai rubrik modul), `comment`, `audioCommentFileKey` (opsional) |

### 5.6 Les privat: jadwal & pertemuan
| Tabel | Kolom penting |
|---|---|
| `lesson_slot` | Jadwal tetap mingguan: `studentId`, `teacherId`, `dayOfWeek`, `startTime`, `durationMinutes`, `location` (`studio`/`rumah siswa`/`online`), `activeFrom`, `activeUntil` |
| `meeting` | Satu pertemuan: `id`, `studentId`, `teacherId`, `date`, `startTime`, `status` (`scheduled`/`hadir`/`izin`/`sakit`/`alpa`/`batal_guru`/`pengganti`), `material` (yang dipelajari), `teacherNote` (catatan untuk siswa), `privateNote` (hanya guru), `slotId` (opsional), `originalDate` (tanggal jadwal tetap asal; unik bersama `slotId`) |

Pertemuan dibuat otomatis dari `lesson_slot` untuk 8 minggu ke depan (dan seminggu ke belakang), dan bisa diubah satu per satu (reschedule, pertemuan pengganti). Pertemuan yang dipindah tetap menyimpan `originalDate`, sehingga pembuatan otomatis tidak membuat duplikat di tanggal asalnya. Pertemuan dari jadwal tetap tidak bisa dihapus (statusnya diubah ke `batal_guru`); pertemuan tambahan bisa dihapus. Status `pengganti` berarti "dipindah ke hari lain".

### 5.7 Pembayaran (disiapkan, dimatikan)
| Tabel | Kolom penting |
|---|---|
| `tuition_plan` | `id`, `name` (mis. "Reguler 4x/bulan"), `pricePerMonth` / `pricePerMeeting` (integer rupiah), `meetingsPerMonth`, `active` |
| `student_plan` | `studentId`, `planId`, `startDate`, `endDate`, `customPrice` (diskon khusus) |
| `invoice` | `id`, `studentId`, `period` (YYYY-MM), `amount`, `dueDate`, `status` (`unpaid`/`partial`/`paid`/`void`), `note` |
| `payment` | `id`, `invoiceId`, `amount`, `method` (`tunai`/`transfer`/`qris`/`lainnya`), `paidAt`, `proofFileKey`, `recordedBy` |

- Uang disimpan sebagai **integer rupiah**, tidak pakai pecahan.
- **Feature flag**: `app_setting` key `features` → `{ "payments": false }`.
  - Helper `isFeatureEnabled("payments")` di server.
  - Saat `false`: menu disembunyikan untuk semua peran, route `/guru/pembayaran/*` mengembalikan 404, server action pembayaran menolak.
  - Tabel tetap dibuat lewat migrasi sejak awal; mengaktifkan = mengubah satu pengaturan di **Pengaturan** guru.
- Tidak ada payment gateway di tahap ini (pencatatan manual oleh guru).

### 5.8 Lain-lain
| Tabel | Kegunaan |
|---|---|
| `app_setting` | Feature flag, nama studio, nomor WA guru, pengaturan pengingat, **durasi default timer rutinitas** (`routine`: `{ warmup: 5, technique: 10, etude: 10, piece: 10 }`) |
| `notification` | Notifikasi dalam aplikasi (tugas baru, rekaman dinilai, jadwal berubah) |
| `push_subscription` | Untuk pengingat latihan via Web Push (tahap 4) |

## 6. Halaman (route)

Prefiks route dalam bahasa Indonesia agar mudah dibaca. Semua halaman diprioritaskan untuk HP.

**Umum:** `/` (beranda studio + tombol Masuk), `/masuk`, `/undangan/[token]`, `/ganti-sandi`.

**Siswa (`/siswa`)**
- `/siswa` beranda: tugas minggu ini, tombol **Mulai latihan**, streak, jadwal les berikutnya, catatan guru terakhir
- `/siswa/belajar` peta unit (terkunci/terbuka) → `/siswa/belajar/[unit]/[pelajaran]`
- `/siswa/latihan` sesi latihan: timer rutinitas 4 segmen, pilih materi, metronom, notasi alphaTab, tuner
- `/siswa/tugas`, `/siswa/tugas/[id]` (rekam & kirim)
- `/siswa/jurnal` riwayat latihan + pelacak mingguan
- `/siswa/jadwal` pertemuan & absensi
- `/siswa/tuner`, `/siswa/metronom` (alat berdiri sendiri)

**Guru (`/guru`)**
- `/guru` dashboard: pertemuan hari ini, rekaman yang menunggu dinilai, siswa yang tidak latihan ≥ 3 hari
- `/guru/siswa` daftar (aktif/nonaktif), **Undang**, **Buat akun** → `/guru/siswa/[id]` profil: kemajuan, jurnal, tugas, rekaman, pertemuan, durasi timer khusus siswa, (paket & tagihan jika pembayaran aktif)
- `/guru/tugas` buat tugas untuk satu/beberapa siswa
- `/guru/penilaian` antrean rekaman → form rubrik
- `/guru/jadwal` kalender mingguan, kelola `lesson_slot`, absensi per pertemuan
- `/guru/kurikulum` lihat unit/pelajaran/karya (editor menyusul)
- `/guru/pembayaran` **(tersembunyi, flag)**
- `/guru/pengaturan` profil studio, feature flag, undangan aktif, durasi default timer rutinitas

## 7. Fitur latihan: detail teknis

- **Notasi (alphaTab)**: sumber MusicXML disimpan sebagai file (`piece.musicXmlFileKey`). Tampilkan notasi balok + tab, tombol putar/jeda, pengatur tempo (persentase atau bpm), loop bagian (birama A–B), kursor. Muat alphaTab hanya di halaman yang butuh (dynamic import, `ssr: false`).
- **Metronom**: Web Audio API langsung (`src/lib/audio.ts`, penjadwal *look-ahead*; tanpa unduhan sampel sehingga bisa offline), bukan `tone`. Ada **tangga tempo** ("+4 bpm"; tombol *Tanpa salah*/*Ada salah*, 3× tanpa salah → naik 4 bpm otomatis). Tempo tertinggi yang benar-benar dimainkan (≥ 10 detik) disimpan ke `practice_session.maxBpm`. Selama belum ada karya (Tahap 2) kuncinya `"general"`; mulai Tahap 2 kuncinya `pieceId` → memperbarui `piece_progress.bestBpm`.
- **Timer rutinitas**: 4 segmen dengan durasi **default 5/10/10/10 menit** (pemanasan/teknik/etude/lagu). Guru bisa mengubah default untuk semua siswa di Pengaturan, dan mengubah khusus untuk satu siswa di profilnya (`student_profile.routineSegments`). Ada bunyi penanda pergantian segmen (dijadwalkan di jam audio, jadi tetap berbunyi saat tab di belakang) dan getar di HP; waktu dihitung dari jam perangkat dan disimpan di `localStorage`, jadi sesi tidak hilang saat halaman dimuat ulang. Saat selesai → isi suasana hati/kesulitan/catatan → simpan `practice_session` → muncul di jurnal. Siswa juga bisa mencatat latihan manual (sampai 7 hari ke belakang) dan menghapus catatan 7 hari terakhir.
- **Rekaman**: `MediaRecorder` (pola `recorder.tsx` / `free-recorder.tsx` Harmoni), batasi durasi (mis. 5 menit) dan ukuran file, unggah ke storage.
- **Tuner**: mikrofon → deteksi frekuensi → nama nada terdekat + selisih cent, dengan tampilan khusus 6 dawai (E A D G B E).
- **Offline ringan / PWA**: manifest + service worker untuk memasang di layar HP; cache aset statis, metronom, dan tuner agar tetap bisa dipakai saat sinyal lemah.

## 8. Tahapan pengerjaan (MVP bertahap)

Setiap tahap selesai = bisa dipakai siswa sungguhan.

**Tahap 0: Fondasi**
- Repo baru dari kerangka Harmoni (auth, UI, i18n, storage, Docker), skema lengkap termasuk tabel pembayaran (flag `false`), skrip setup guru, seed kurikulum Unit 1.
- ✅ Selesai jika: guru bisa masuk; sign-up langsung ditolak; migrasi bersih dari nol.

**Tahap 1: Unit 1 + latihan dasar**
- Undangan & buat akun, profil siswa aktif/nonaktif.
- Peta unit, pelajaran Unit 1 (teks, gambar, checklist, kuis kecil), pembuka bertahap, Cek Unit 1 + persetujuan guru.
- Sesi latihan: timer rutinitas, metronom dengan tangga tempo, jurnal & streak, pelacak mingguan.
- Jadwal tetap + pertemuan + absensi + catatan guru.
- ✅ Selesai jika: 2–3 siswa uji coba bisa diundang, belajar Unit 1, mencatat latihan seminggu, dan guru melihat semuanya di dashboard.
- **Status (11 Nov 2026): kode selesai dan diuji di browser** (lihat catatan di bawah). Tinggal uji coba dengan siswa sungguhan.
- Catatan Tahap 1:
  - Isi pelajaran Unit 1 berupa teks, tabel, checklist, kuis, tips, dan target; notasi latihan memakai blok `score` yang untuk sementara merujuk ke halaman modul cetak (alphaTab di Tahap 2). Gambar dari PDF modul **tidak** dimasukkan karena asal-usulnya (buku sumber) belum jelas; foto/gambar buatan sendiri bisa ditambahkan sebagai blok `image`.
  - Kuis hanya umpan balik langsung, jawabannya tidak disimpan. "Tandai selesai" tidak mewajibkan checklist penuh; Cek Unit wajib terisi semua.
  - Guru bisa membuka/mengunci unit secara manual di profil siswa, selain lewat persetujuan Cek Unit.
  - Halaman `/guru/kurikulum` belum dibuat (tidak wajib untuk Tahap 1).

**Tahap 2: Notasi interaktif**
- alphaTab + karya Unit 1 dalam MusicXML (hasil tulis ulang notasi), target 3 tahap per karya, `piece_progress`.
- Unit 2–4 dimasukkan bertahap sesuai selesainya notasi.

**Tahap 3: Tugas, rekaman, penilaian**
- Guru memberi tugas per siswa, siswa merekam & mengirim, guru menilai dengan rubrik 5 aspek, notifikasi dalam aplikasi.

**Tahap 4: Pelengkap**
- Tuner, pengingat latihan (Web Push), editor kurikulum di dashboard.
- Pembayaran: **tinggal dinyalakan** dan diuji ketika diputuskan dipakai.

## 9. Konten dan hak cipta

- Sumber kurikulum: *Modul Latihan Gitar Klasik* (acuan di Project "Guitar Lesson", kanvas: https://claude.ai/artifact/JEQEg7pU3V5eYSBBZpD7wQ).
- **Jangan unggah scan notasi dari buku sumber ke aplikasi.** Pakai notasi tulis ulang (MusicXML) dengan `copyrightStatus` terisi:
  - karya abad ke-19 (Carulli, Sor, Aguado, Giuliani, Carcassi, Küffner, Cano), lagu rakyat, dan karya anonim → `public_domain`;
  - latihan buatan sendiri → `own_work`;
  - **Walts, B. Calatayud** → kemungkinan masih dilindungi; ganti atau `licensed` setelah ada izin;
  - latihan karangan penulis buku sumber → buat latihan baru (`own_work`).
- Video demonstrasi direkam sendiri oleh guru.

## 10. Keamanan dan privasi

- Data anak-anak: batasi data pribadi (tidak wajib email, cukup username; tahun lahir opsional).
- Semua akses dicek di server berdasarkan peran **dan** kepemilikan (siswa hanya datanya sendiri).
- Token undangan disimpan sebagai hash, sekali pakai, ada masa berlaku; batasi percobaan (rate limit, pakai `ratelimit.ts` Harmoni).
- File rekaman disajikan lewat route yang memeriksa hak akses (bukan URL publik).
- Backup database harian (`backup.sh` Harmoni).

## 11. Keputusan tambahan (3 Nov 2026)

| Pertanyaan | Keputusan |
|---|---|
| Nama aplikasi | **Harmoni Gitar**: satu keluarga dengan LMS Harmoni. Nama tampilan tetap disimpan di `app_setting` (`studioName`) agar bisa diganti tanpa mengubah kode. Saran nama teknis: repo `harmoni-gitar`, nama Docker Compose `harmoni-gitar`, database `harmoni_gitar` (berbeda dari `harmoni` milik LMS Harmoni agar keduanya bisa berjalan bersamaan di localhost). |
| Hosting | **Sementara localhost** dengan Docker Compose seperti LMS Harmoni. VPS + domain + Caddy menyusul. |
| Siswa nonaktif | **Sama sekali tidak bisa masuk** (lihat 4.5). |
| Timer rutinitas | **Default 5/10/10/10 menit**, guru bisa mengubah default dan per siswa (lihat bagian 7). |
| Akun orang tua | **Belum dibuat.** Fokus ke guru dan siswa. |

### Ditunda (bukan bagian MVP)
- **Akun orang tua**: peran `parent`, tabel `parent_link` (parentId, studentId, relation), undangan orang tua yang terhubung ke anak, dan halaman `/ortu` (ringkasan anak, tagihan). Saat dibutuhkan, cukup tambah nilai enum `role` dan tabel baru lewat migrasi; struktur lain tidak perlu diubah.
