# Notasi karya (MusicXML)

Notasi untuk pemutar alphaTab. Setiap karya punya file dengan nama yang sama:

```
content/pieces/
├── lightly-row.json        # data karya (wajib)
├── lightly-row.musicxml    # notasi hasil TULIS ULANG (wajib agar tampil)
└── lightly-row.notes       # opsional: sumber teks ringkas, diubah menjadi .musicxml oleh `npm run scores:build`
```

Setelah menambah/mengubah karya: `npm run db:seed` (menyalin MusicXML ke penyimpanan file dan memperbarui database).
Lewat Docker: `docker compose --env-file .env.docker --profile tools run --rm tools`.

## `<slug>.json`

```jsonc
{
  "slug": "lightly-row",              // = nama file; dipakai blok "score" di content/units
  "title": "Lightly Row",
  "composer": "Lagu rakyat",          // opsional
  "defaultBpm": 80,                   // tempo yang tertulis di MusicXML (kecepatan 100%)
  "stageBpm": { "1": 50, "2": 65, "3": 80 },   // Tahap 1 Pelan, 2 Sedang, 3 Tempo asli (1 <= 2 <= 3)
  "timeSignature": "4/4",
  "copyrightStatus": "public_domain", // WAJIB: public_domain | own_work | licensed | unknown
  "sourceNote": "…"                   // opsional, tampil kecil di bawah notasi
}
```

## Dari MuseScore

Simpan sebagai **MusicXML tidak terkompresi** (`.musicxml`) dengan nama `<slug>.musicxml`, buat `<slug>.json`, lalu
`npm run db:seed`. Pastikan tempo di awal karya sama dengan `defaultBpm`. File `.notes` tidak diperlukan.

## Format `.notes` (untuk latihan sederhana yang ditulis tangan)

`npm run scores:build` (atau `npm run scores:build -- <slug>`) membuat `<slug>.musicxml` dari `<slug>.notes`.
Setiap birama diperiksa: jumlah ketukannya harus pas dengan sukat (kecuali birama pertama yang lebih pendek = birama
gantung).

```
time 4/4            # sukat awal
tempo 80            # = defaultBpm
part Gitar 1        # satu "part" = satu gitar (duet: dua part)
[C] 1.3:q 1.0:q 1.0:h | [G7] 1.1:q 2.3:q 2.3:h !!
part Gitar 2
1.0:q 2.1:q 2.1:h | 2.3:q 2.0:q 2.0:h !!
part Gitar 1 voice 2   # suara kedua di gitar yang sama (mis. bas yang ditahan)
```

| Tulisan | Arti |
|---|---|
| `1.3:q` | dawai ① fret 3, not 1/4. Dawai 1 (E tinggi) … 6 (E rendah); nada dihitung dari stem standar. |
| `w h q e s` | not penuh, 1/2, 1/4, 1/8, 1/16; titik di belakang = bertitik (`h.`) |
| `1.0i:q` | huruf p i m a setelah fret = jari tangan kanan |
| `5.3p+1.0m:h` | beberapa nada bersamaan (petikan rangkap / akor) |
| `r:q` | tanda diam |
| `[G7]` | nama akor di atas paranada (untuk iringan guru) |
| `<Latihan 1>` | penanda bagian |
| `{Fine}` `{D.C. al Fine}` | tanda lompatan (alphaTab memutarnya dengan benar) |
| `T3/4` | ganti sukat mulai birama ini |
| `key -1` | tanda mula (baris sendiri, seperti `time`): -7…7, negatif = mol (nada hitam ditulis ♭) |
| `\|` `!!` `!end` | batas birama, garis birama ganda, garis penutup |
| `# …` | komentar |

## Hak cipta (wajib dibaca)

- **Jangan pernah** memasukkan scan atau foto notasi dari buku sumber.
- `copyrightStatus` wajib diisi; status `unknown` **selalu disembunyikan** dari siswa (guru masih bisa melihat di Kurikulum).
  - Karya abad ke-19 (Carulli, Sor, Aguado, Giuliani, Carcassi, Küffner, Cano), lagu rakyat, anonim → `public_domain`
  - Latihan buatan sendiri → `own_work`
  - **Walts, B. Calatayud** → kemungkinan masih dilindungi: ganti, atau `licensed` setelah ada izin
  - Latihan karangan penulis buku sumber → buat latihan baru (`own_work`)
- Jangan isi elemen `<rights>` di MusicXML: alphaTab menampilkannya dengan tambahan "All Rights Reserved".

## Isi saat ini (Tahap 2)

15 karya Unit 1. Tiga lagu rakyat ditulis ulang (`public_domain`): Lightly Row, Aura Lee, Moon Night (*Au clair de la
lune*). Suara kedua dan akornya disusun sendiri. Dua belas latihan lainnya **dibuat baru** (`own_work`) dengan tujuan
yang sama seperti latihan di modul (bukan salinan latihan buku sumber). Unit 2–4 menyusul.

Lihat juga bagian 9 di [docs/RENCANA_TEKNIS.md](../../docs/RENCANA_TEKNIS.md).

## Partitur buatan guru di aplikasi

Guru juga bisa menulis partitur di aplikasi (Materi → Tulis partitur, editor visual) atau mengunggah MusicXML dari
MuseScore. Partitur itu disimpan di database dan penyimpanan file, **bukan** di folder ini, dan tidak pernah diubah
oleh `npm run db:seed`. Slug file di sini tidak boleh sama dengan slug partitur buatan guru (seed akan menolak).
Pengubah `.notes` dan editor memakai penulis MusicXML yang sama: `src/lib/score/musicxml.ts`.
