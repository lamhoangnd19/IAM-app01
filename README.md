# Momentum

> Triển khai trên máy ảo Ubuntu và cho phép máy khác trong LAN truy cập: xem [DEPLOY_UBUNTU.md](DEPLOY_UBUNTU.md).

Website theo dõi thói quen cá nhân, có đăng ký, đăng nhập và dashboard dành riêng cho người dùng. Dữ liệu tài khoản được lưu trong Microsoft SQL Server; mật khẩu được băm bằng bcrypt trước khi lưu.

## Công nghệ

- Node.js, Express, EJS
- Microsoft SQL Server (`mssql`)
- Session cookie, CSRF token, rate limiting, Helmet
- Giao diện responsive thuần CSS/JavaScript

## Cài đặt

Yêu cầu Node.js 20+ và một SQL Server đang chạy.

```powershell
npm install
Copy-Item .env.example .env
```

Mở `.env` và sửa `DB_SERVER`, `DB_USER`, `DB_PASSWORD` cho đúng với SQL Server của bạn. Sau đó tạo database và bảng:

```powershell
npm run db:init
```

Bạn cũng có thể chạy trực tiếp tệp `database.sql` trong SQL Server Management Studio thay cho lệnh trên.

Nếu chưa có SQL Server local nhưng đã cài Docker, có thể khởi động nhanh bằng:

```powershell
docker compose up -d
npm run db:init
```

Mật khẩu container mẫu trùng với `.env.example`; hãy đổi mật khẩu này nếu triển khai thật.

## Chạy website

```powershell
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu trúc bảng người dùng

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `Id` | `INT IDENTITY` | Khóa chính |
| `Username` | `NVARCHAR(50)` | Tên đăng nhập, duy nhất |
| `PasswordHash` | `NVARCHAR(255)` | Mật khẩu đã băm bằng bcrypt |
| `CreatedAt` | `DATETIME2` | Ngày tạo tài khoản |

> Trong môi trường production, hãy đặt `SESSION_SECRET` thành chuỗi ngẫu nhiên dài, bật HTTPS, đặt `DB_ENCRYPT=true` khi hạ tầng hỗ trợ, và thay session MemoryStore bằng Redis hoặc SQL-backed session store.
