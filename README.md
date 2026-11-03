# Harmoni Gitar

Aplikasi web les gitar klasik privat: siswa berlatih mandiri dan teratur mengikuti kurikulum
*Modul Latihan Gitar Klasik*. Hanya siswa yang diundang guru yang bisa masuk.

- Rencana lengkap: [docs/RENCANA_TEKNIS.md](docs/RENCANA_TEKNIS.md)
- Format konten kurikulum: [content/README.md](content/README.md)
- Status: **Tahap 0 (fondasi)**: login, peran guru/siswa, skema database lengkap, pengaturan studio.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL 17 + Drizzle ORM, Better Auth, Docker Compose.
Port sengaja berbeda dari LMS Harmoni (app **3001**, PostgreSQL **5433**, database `harmoni_gitar`) agar
keduanya bisa berjalan bersamaan.

## Menjalankan untuk pengembangan

Butuh Node.js 22 dan Docker.

```bash
npm install
cp .env.docker.example .env.docker     # isi POSTGRES_PASSWORD dan BETTER_AUTH_SECRET
cp .env.example .env.local             # isi BETTER_AUTH_SECRET dan kata sandi di DATABASE_URL (= POSTGRES_PASSWORD)

docker compose --env-file .env.docker up -d db   # PostgreSQL di 127.0.0.1:5433
npm run db:migrate                               # buat tabel
npm run db:seed                                  # isi unit & pelajaran dari content/units
npm run setup:teacher -- --name "Pak Rangga" --email guru@contoh.com --password "kata-sandi-kuat"
npm run dev                                      # http://localhost:3001
```

Masuk di http://localhost:3001/masuk dengan email (atau `--username` bila diberikan) dan kata sandi tadi.

## Menjalankan semuanya lewat Docker

```bash
docker compose --env-file .env.docker up -d --build          # migrasi otomatis saat app start
docker compose --env-file .env.docker --profile tools run --rm tools      # isi kurikulum
docker compose --env-file .env.docker --profile tools run --rm tools npm run setup:teacher -- \
  --name "Pak Rangga" --email guru@contoh.com --password "kata-sandi-kuat"
```

Agar HP di Wi-Fi yang sama bisa membuka aplikasi, ubah port `app` di `docker-compose.yml` menjadi
`"${APP_PORT:-3001}:3001"` dan isi `BETTER_AUTH_URL=http://<IP-komputer-guru>:3001` (link undangan memakai alamat ini).

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan di port 3001 |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run db:generate` | Buat file migrasi baru setelah mengubah `src/db/schema.ts` |
| `npm run db:migrate` | Jalankan migrasi di folder `drizzle/` |
| `npm run db:seed` | Muat kurikulum dari `content/units/*.json` (aman diulang) |
| `npm run setup:teacher` | Buat akun guru pertama (ditolak bila sudah ada guru) |
| `./scripts/backup.sh` | Backup database + file unggahan ke `./backups` (bisa dijadwalkan dengan cron) |

## Akun dan hak akses

- **Tidak ada pendaftaran terbuka.** Endpoint sign-up Better Auth dimatikan (`disableSignUp`), dan setiap pembuatan
  akun di luar skrip guru, undangan, atau guru ditolak di `databaseHooks.user.create.before` (`src/lib/auth.ts`).
- Peran: `teacher` dan `student`. `/guru/*` hanya untuk guru, `/siswa/*` hanya untuk siswa; dicek di layout dan di
  setiap server action (`src/lib/session.ts`).
- Siswa nonaktif: `banned = true` (plugin `admin` Better Auth), tidak bisa masuk sama sekali.
- Akun dengan kata sandi awal dari guru (`mustChangePassword`) harus mengganti sandi di `/ganti-sandi` dulu.
- File (`/api/files/...`) tidak pernah publik: rekaman hanya untuk siswa pemiliknya dan gurunya.

## Fitur pembayaran

Tabel pembayaran sudah ada, tetapi fiturnya mati (`app_setting` `features.payments = false`). Saklarnya ada di
**Pengaturan** guru. Halaman dan action pembayaran (dibuat di Tahap 4) wajib memakai `requireFeature("payments")` /
`assertFeature("payments")` dari `src/lib/features.ts`.
