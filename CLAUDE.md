@AGENTS.md

# Harmoni Gitar

Aplikasi web les gitar klasik privat milik Pak Rangga: siswa berlatih mandiri dan teratur mengikuti kurikulum *Modul Latihan Gitar Klasik*. Hanya siswa yang diundang guru yang bisa masuk.

**Rencana lengkap (database, alur akun, halaman, tahapan): [docs/RENCANA_TEKNIS.md](docs/RENCANA_TEKNIS.md).** Baca bagian yang relevan sebelum mengerjakan fitur, dan perbarui dokumen itu jika ada keputusan yang berubah.

## Stack

Sama dengan LMS Harmoni (https://github.com/djrecycle/LMS_Harmoni): Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PostgreSQL 17 + Drizzle ORM, Better Auth (plugin `username` + `admin`), Docker Compose. Tambahan: alphaTab (notasi + tab, Tahap 2), Web Audio API langsung untuk metronom/timer (`src/lib/audio.ts`), `react-markdown` untuk isi pelajaran.

Next.js versi ini punya perubahan besar dari versi lama: baca dokumen di `node_modules/next/dist/docs/` sebelum menulis kode yang memakai API Next.

## Menjalankan (localhost)

- App: `npm run dev` → http://localhost:3001
- Database: `docker compose --env-file .env.docker up -d db` (PostgreSQL di port **5433**, database `harmoni_gitar`)
- Semua lewat Docker: `docker compose --env-file .env.docker up -d --build`
- Migrasi: `npm run db:generate` lalu `npm run db:migrate`
- Cek tipe: `npm run typecheck`

Port dan nama database sengaja berbeda dari LMS Harmoni (3000 / 5432 / `harmoni`) agar keduanya bisa berjalan bersamaan.

## Aturan penting

- **Tidak ada pendaftaran terbuka.** Akun hanya lewat link undangan atau dibuat guru. Jangan menambah halaman/endpoint daftar publik.
- **Peran saat ini: `teacher` dan `student` saja.** Akun orang tua ditunda.
- **Hak akses dicek di server** (server action / route handler) berdasarkan peran *dan* kepemilikan data, bukan hanya disembunyikan di tampilan.
- **Siswa nonaktif tidak bisa masuk sama sekali** (`banned = true`, sesi dicabut); datanya tidak dihapus.
- **Pembayaran: tabel ada, fitur mati.** Semua menu, halaman, dan action pembayaran harus mengecek `isFeatureEnabled("payments")`; saat `false` → menu tersembunyi, route 404, action ditolak.
- **Uang disimpan sebagai integer rupiah.**
- **Notasi:** hanya MusicXML hasil tulis ulang dengan `copyrightStatus` terisi. Jangan memasukkan scan notasi dari buku sumber.
- Teks tampilan dalam bahasa Indonesia (bawaan) lewat sistem i18n; nama tabel/kolom/kode dalam bahasa Inggris.
- Tampilan diprioritaskan untuk HP.

## Cara kerja

- Kerjakan per tahap sesuai bagian 8 di rencana teknis; jangan melompat ke fitur tahap berikutnya tanpa diminta.
- Saat menyalin kode dari LMS Harmoni, sesuaikan dan buang bagian yang tidak dipakai (AI perangkat ajar, kalender akademik, kuis MIDI, piano roll).
- Setiap perubahan skema database lewat migrasi Drizzle, bukan mengubah database langsung.
- Sebelum menyatakan selesai: jalankan `npm run typecheck` dan coba alurnya di browser.
