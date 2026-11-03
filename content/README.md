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
| `tip` | `{ "markdown": "…" }` |
| `focus` | `{ "markdown": "…" }` (hal yang diperhatikan saat berlatih) |
| `target` | `{ "markdown": "…" }` (target tempo/kemampuan) |

Bentuk `data` di atas masih bisa berubah saat tampilan pelajaran dibuat; perbarui tabel ini bila berubah.

### Aturan pembaruan

- Unit dicocokkan lewat `slug`, pelajaran lewat (unit, `slug`), blok dan butir Cek Unit lewat **urutannya**.
  Yang cocok diperbarui di tempat, jadi kemajuan siswa tetap tersambung.
- Blok/butir Cek Unit yang berlebih (file jadi lebih pendek) dihapus beserta centang siswa pada blok itu.
- Pelajaran yang dihapus dari file **tidak** dihapus dari database (kemajuan siswa ikut terhapus); skrip hanya
  memberi peringatan. Sembunyikan dengan `"published": false`.

Status saat ini (Tahap 0): keempat unit baru berisi judul dan daftar pelajaran sesuai modul, plus 12 butir
Cek Unit 1. Isi pelajaran (`blocks`) masih kosong dan semua pelajaran `published: false`.
