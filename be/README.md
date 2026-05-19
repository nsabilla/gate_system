# RFQ Backend (Go + MySQL)

Backend API untuk RFQ Management System.

## Ringkasan

- Framework: `net/http` + `gorilla/mux`
- ORM: `gorm` (v1)
- DB: MySQL + Stored Procedure
- Auth: JWT berbasis cookie HttpOnly (`access_token` + `refresh_token`)
- API prefix default: `/api/v1`

## Prasyarat

- Go (ikuti versi di `go.mod`)
- MySQL aktif
- Database sudah dibuat (contoh: `project_rfq`)

Catatan:
- `WEB_PORT`/`PREFIX` (uppercase) juga didukung.
- Pastikan frontend mengarah ke `http://localhost:8085/api/v1`.

## Setup Database

Folder script DB ada di `db/`.

Minimal SP yang harus di-import:
1. `db/sp_rfq_crud`
2. `db/sp_rfq_list`
3. `db/sp_mainactivity.sql`
4. `db/sp_rfq_activity_plan.sql`
5. `db/sp_master_rfq_activity.sql`
6. (opsional) `db/sp_dashboard_main_activity.sql`

Untuk data contoh dashboard cepat:
- Jalankan `db/seed_dashboard_testing.sql`

## Menjalankan Aplikasi

```bash
cd rfq-backend
go run main.go
```

Server default:
- Base URL: `http://localhost:8085`
- API Prefix: `http://localhost:8085/api/v1`

## Endpoint Utama

### Auth
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /register`
- `GET /me`
- `PUT /me`

### Users
- `GET /users`
- `GET /users/{id}`
- `POST /users`
- `PUT /users/{id}`
- `DELETE /users/{id}`

### RFQ
- `POST /rfqs` (marketing)
- `GET /rfqs`
- `GET /rfqs/{id}`
- `DELETE /rfqs/{id}` (marketing)
- `PUT /rfqs/products` (marketing)
- `DELETE /rfqs/products` (marketing)

### Activity & Dashboard
- `GET /rfqs/mainactivity`
- `GET /rfqs/{id}/timeline`
- `POST /rfqs/{id}/activity/move` (marketing)
- `GET /rfqs/{id}/dashboard-activity` (marketing)
- `GET /rfq-activities`
- `GET /rfq-activities/master` (marketing)
- `POST /rfq-activities/master` (marketing)
- `PUT /rfq-activities/master/{id}` (marketing)
- `DELETE /rfq-activities/master/{id}` (marketing)

## Perilaku Fitur Dashboard (Penting)

- Endpoint dashboard membaca data dari `rfq_activity_plan` + master activity (`rfq_activity`).
- Action `Move Activity` sekarang otomatis sinkron ke `rfq_activity_plan` (upsert), termasuk `target_date` dari frontend.
- Kolom PIC dashboard mengembalikan format `ROLECODE-USERNAME` (contoh: `MKT-Marketing User`) dengan referensi tabel `rolecode`.

## Rule Bisnis Activity & Approval

- Initial move:
	- Jika RFQ belum punya current activity (`statusactivity` kosong), activity pertama wajib `code_act = 0`.
- Sequential move:
	- Activity tidak boleh mundur.
	- Activity tidak boleh loncat; hanya current atau next (`+1`).
- Target date validation:
	- Saat pindah ke next activity, `target_date` wajib diisi.
	- `target_date` next activity harus lebih besar dari target date activity sebelumnya.
- Approval rule:
	- RFQ hanya bisa di-approve jika `code_act` current activity bernilai `3`.
	- Format code activity fleksibel (mis. `3` atau `ACT-03`), backend menormalisasi ke nilai numerik.

## Testing

Struktur test:

- Unit test RFQ dipisah ke folder `app/controllers/rfq/unittest`.
- Unit test package lain tetap di folder package masing-masing (`*_test.go`).
- Integration/E2E test dipisah ke folder `tests/integration/`.

Menjalankan test RFQ controller:

```bash
cd rfq-backend
go test ./app/controllers/rfq/unittest -v
```

Semua test:

```bash
cd rfq-backend
go test ./...
```

## REST Collection Sederhana

Lihat `test.rest` untuk register/login dan cek dashboard endpoint.

## Troubleshooting

### 1) `go run main.go` gagal karena cwd salah
Gunakan path absolut atau masuk ke folder backend dulu:

```powershell
Set-Location D:\project-rfq\rfq-backend
go run main.go
```

### 2) `listen tcp :8085 bind ... already in use`
Port `8085` sudah dipakai proses lain. Hentikan proses tersebut atau ganti `web_port` di `.env`.

### 3) Dashboard kosong padahal data ada
Periksa:
- user login role `marketing`
- ada row di `rfq_activity`
- ada row `rfq_activity_plan` untuk `rfq_id` terkait
- endpoint `GET /rfqs/{id}/dashboard-activity` mengembalikan data

### 4) Frontend bisa jalan di port acak (`5173/5174/5175`)
CORS backend sudah fleksibel untuk `http://localhost:*` dan `http://127.0.0.1:*`.
