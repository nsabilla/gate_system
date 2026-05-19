# Testing Structure

Struktur test backend dipisah seperti ini:

- `app/**/**/*_test.go` → **Unit test** (tetap satu package dengan logic agar stabil dan bisa test helper internal).
- `tests/integration/**` → **Integration/E2E test** lintas package / API end-to-end.

Alasan unit test tetap di folder package:

- Ini best practice di Go agar test bisa mengakses behavior package secara utuh.
- Memindahkan semua unit test ke folder terpisah akan mengubah banyak test menjadi black-box dan menurunkan cakupan helper/internal flow.

## Menjalankan test

- Semua test: `go test ./...`
- Unit test RFQ saja: `go test ./app/controllers/rfq/...`
- Integration test (jika sudah ada): `go test ./tests/integration/...`

## Dummy data per role

- File request dummy user: `tests/integration/dummy_users_5_each_role.rest`
- Isi file tersebut membuat 5 user untuk tiap role: marketing, engineering, accounting, purchasing.
- Jalankan berurutan dari VS Code REST Client atau copy request ke Postman.
