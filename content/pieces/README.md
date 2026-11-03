# Notasi karya (MusicXML)

Tempat file notasi untuk alphaTab (mulai Tahap 2). Setiap karya terdiri dari dua file dengan nama yang sama:

```
content/pieces/
├── lightly-row.musicxml    # notasi hasil TULIS ULANG (MuseScore dsb.), bukan scan buku
└── lightly-row.json        # data karya
```

```jsonc
{
  "slug": "lightly-row",              // = nama file; dipakai blok "score" di content/units
  "title": "Lightly Row",
  "composer": "Lagu rakyat",
  "defaultBpm": 80,
  "stageBpm": { "1": 50, "2": 65, "3": 80 },   // Tahap 1 Pelan, 2 Sedang, 3 Tempo asli
  "timeSignature": "4/4",
  "copyrightStatus": "public_domain", // WAJIB: public_domain | own_work | licensed | unknown
  "sourceNote": "Ditulis ulang dari modul hal. 12"
}
```

## Hak cipta (wajib dibaca)

- **Jangan pernah** memasukkan scan atau foto notasi dari buku sumber.
- `copyrightStatus` wajib diisi; karya tanpa status yang jelas tidak boleh ditampilkan ke siswa.
  - Karya abad ke-19 (Carulli, Sor, Aguado, Giuliani, Carcassi, Küffner, Cano), lagu rakyat, anonim → `public_domain`
  - Latihan buatan sendiri → `own_work`
  - **Walts, B. Calatayud** → kemungkinan masih dilindungi: ganti, atau `licensed` setelah ada izin
  - Latihan karangan penulis buku sumber → buat latihan baru (`own_work`)

Lihat juga bagian 9 di [docs/RENCANA_TEKNIS.md](../../docs/RENCANA_TEKNIS.md).
