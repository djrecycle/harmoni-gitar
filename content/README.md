# Konten kurikulum

Kurikulum *Modul Latihan Gitar Klasik* disimpan sebagai file di repo agar bisa direvisi lewat Git, lalu
dimasukkan ke database dengan:

```bash
npm run db:seed
```

Skrip ini aman dijalankan berulang kali. Isinya divalidasi dulu: jika satu file salah, tidak ada yang berubah.

## `units/unit-N.json`

Satu file per unit.

```jsonc
{
  "slug": "unit-1",                 // unik, huruf kecil/angka/tanda minus; jangan diganti setelah dipakai siswa
  "order": 1,                       // urutan unit
  "title": "Dasar-dasar",
  "color": "#0f766e",               // opsional, warna unit di peta belajar
  "description": "…",               // opsional
  "lessons": [                      // urutan di array = urutan pelajaran (pembuka bertahap mengikuti urutan ini)
    {
      "slug": "kenali-gitar",       // unik di dalam unit; jangan diganti setelah dipakai siswa
      "title": "Kenali Gitarmu",
      "kind": "theory",             // theory | technique | etude | piece | check
      "summary": "…",               // opsional
      "estimatedMinutes": 15,       // opsional
      "published": false,           // hanya pelajaran yang published yang tampil ke siswa
      "blocks": [                   // isi pelajaran, urut dari atas ke bawah
        { "type": "text", "data": { "markdown": "…" } }
      ]
    }
  ],
  "checkItems": [                   // butir "Cek Unit" (siswa menilai diri: belum / hampir / sudah)
    "Menyebut bagian-bagian gitar"
  ]
}
```

### Jenis blok (`type`) dan isi `data`

| type | data (rencana; dipakai mulai Tahap 1–2) |
|---|---|
| `text` | `{ "markdown": "…" }` |
| `image` | `{ "fileKey": "media/…", "alt": "…", "caption": "…" }` |
| `video` | `{ "url": "…" }` atau `{ "fileKey": "media/…" }` (video direkam sendiri oleh guru) |
| `score` | `{ "piece": "<slug karya di content/pieces>" }` |
| `checklist` | `{ "title": "…", "items": ["…", "…"] }` |
| `quiz` | `{ "question": "…", "options": ["…"], "answer": 0 }` |
| `tip` | `{ "markdown": "…", "title": "…" }` (`title` opsional, bawaan "Tips") |
| `focus` | `{ "markdown": "…", "title": "…" }` (hal yang diperhatikan saat berlatih; bawaan "Perhatian") |
| `target` | `{ "markdown": "…", "title": "…" }` (target tempo/kemampuan; bawaan "Target") |

Detail tambahan:
- `checklist`: 1–30 butir; centang siswa disimpan per butir (urutan butir jangan diubah setelah dipakai siswa).
- `quiz`: 2–6 pilihan, `answer` = indeks jawaban benar (mulai 0), `explain` opsional (tampil setelah benar). Jawaban tidak disimpan.
- `score`: `{ "piece": "<slug>", "note": "…" }`. Sampai alphaTab tersedia (Tahap 2) yang tampil hanya `note`.

Bentuk `data` divalidasi saat `npm run db:seed` (`src/lib/blocks.ts`): blok yang tidak sesuai jenisnya membuat seed gagal.

### Aturan pembaruan

- Unit dicocokkan lewat `slug`, pelajaran lewat (unit, `slug`), blok dan butir Cek Unit lewat **urutannya**.
  Yang cocok diperbarui di tempat, jadi kemajuan siswa tetap tersambung.
- Blok/butir Cek Unit yang berlebih (file jadi lebih pendek) dihapus beserta centang siswa pada blok itu.
- Pelajaran yang dihapus dari file **tidak** dihapus dari database (kemajuan siswa ikut terhapus); skrip hanya
  memberi peringatan. Sembunyikan dengan `"published": false`.

Status saat ini (Tahap 1): **Unit 1 lengkap** (17 pelajaran, semua `published: true`, plus 12 butir Cek Unit 1).
Unit 2–4 baru berisi judul dan daftar pelajaran, semua `published: false`; isinya menyusul bersama notasi (Tahap 2).
