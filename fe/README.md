# RFQ Frontend (React + TypeScript + Vite)

Frontend untuk RFQ Management System.

## Ringkasan

- Framework: React 19 + TypeScript
- Build tool: Vite
- Routing: `react-router-dom`
- HTTP client: Axios (`withCredentials: true`)
- Styling: Tailwind CSS

## Prasyarat

- Node.js 20+
- Backend berjalan di `http://localhost:8085`

## Menjalankan Lokal

```bash
cd rfq-frontend
npm install
npm run dev
```

Build produksi:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```

## Konfigurasi API

Axios default ada di `src/api/axios.ts`:

- Base URL: `http://localhost:8085/api/v1`
- `withCredentials: true` untuk cookie auth
- Auto refresh token ketika `401`

Jika backend berjalan di port berbeda, sesuaikan `baseURL`.

## Alur Auth

- Login berhasil -> backend set cookie HttpOnly
- Frontend memanggil `/me` pada bootstrap (`AuthContext`)
- Route dilindungi oleh `ProtectedRoute`
- Logout memanggil `/logout` lalu redirect ke `/login`

## Halaman Utama

- `/login` -> Login
- `/main/dashboard` -> Home
- `/main/create-rfq` -> Create RFQ (marketing)
- `/main/rfq-list` -> RFQ list + detail (semua role login)
- `/main/manage-rfq` -> Manage RFQ + Move Activity (marketing)
- `/main/activity-dashboard` -> Dashboard activity per RFQ (marketing)
- `/main/master-activity` -> Master activity CRUD (marketing)
- `/main/users` -> User management

## Fitur Activity Dashboard

- Data diambil dari `GET /rfqs/{id}/dashboard-activity`
- Kolom PIC mengikuti format backend: `ROLECODE-USERNAME` (contoh: `MKT-Marketing User`).

## Fitur Move Activity (Manage RFQ)

- Action `Move Activity` mengirim:
  - `statusactivity`
  - `target_date`
  - `remarks`
- Backend otomatis sinkron ke `rfq_activity_plan`, sehingga dashboard langsung ter-update.
- Validasi utama:
  - activity awal harus `code_act = 0`
  - perpindahan harus berurutan (current atau next)
  - saat pindah ke next activity, `target_date` wajib dan harus lebih besar dari target date activity sebelumnya

## Troubleshooting

### 1) `npm run dev` pindah port otomatis (5173 -> 5174/5175)
Normal. Backend CORS sudah dibuat fleksibel untuk `localhost:*`.

### 2) UI login berulang balik ke `/login`
Periksa:
- backend aktif
- baseURL axios benar
- cookie tidak diblok browser

### 3) Dashboard activity kosong
Periksa:
- user role `marketing`
- RFQ yang dipilih benar
- sudah ada plan activity untuk RFQ tersebut
- endpoint `/rfqs/{id}/dashboard-activity` mengembalikan data
