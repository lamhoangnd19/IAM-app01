# Triển khai Momentum trên Ubuntu trong mạng LAN

Kiến trúc triển khai:

```text
Máy trong LAN ── http://IP_CUA_VM:3000 ──> Momentum (Node.js)
                                               │
                                               └── MSSQL (mạng Docker nội bộ)
```

Chỉ cổng web `3000` được công khai. Cổng MSSQL `1433` không được đưa ra LAN.

## 1. Chuẩn bị máy ảo

- Nên dùng Ubuntu Server 22.04, 24.04 hoặc 26.04 LTS 64-bit.
- Cấu hình card mạng của VM ở chế độ **Bridged Adapter** để VM nhận IP cùng dải với các máy khác. Nếu bắt buộc dùng NAT, cần cấu hình port forwarding từ máy host tới cổng `3000` của VM.
- Nên đặt IP tĩnh hoặc DHCP reservation cho VM, ví dụ `192.168.1.50`.
- Khuyến nghị tối thiểu 2 CPU, 4 GB RAM và 15 GB ổ đĩa vì SQL Server cần tương đối nhiều bộ nhớ.

Kiểm tra IP của VM:

```bash
hostname -I
ip -br address
```

Từ một máy khác trong LAN, cần ping được IP này trước khi triển khai ứng dụng.

## 2. Cài Docker Engine và Compose

Cài Docker Engine từ repository chính thức của Docker. Hướng dẫn cập nhật nằm tại:

- https://docs.docker.com/engine/install/ubuntu/
- https://docs.docker.com/compose/install/linux/

Sau khi cài, kiểm tra:

```bash
sudo docker version
sudo docker compose version
```

Các lệnh bên dưới dùng `sudo`. Nếu đã thêm tài khoản vào nhóm `docker`, có thể bỏ `sudo`.

## 3. Chuyển source code lên VM

Có thể dùng Git hoặc SCP. Ví dụ chạy từ máy đang chứa dự án:

```bash
scp -r IAM_app1 user@192.168.1.50:/opt/momentum
```

Sau đó đăng nhập vào VM:

```bash
ssh user@192.168.1.50
cd /opt/momentum
```

Đảm bảo tài khoản triển khai có quyền đọc/ghi thư mục dự án.

## 4. Tạo cấu hình production

```bash
cp .env.example .env
openssl rand -hex 32
nano .env
```

Sửa tối thiểu các giá trị sau trong `.env`:

```dotenv
APP_PORT=3000
APP_BIND_IP=192.168.1.50
SESSION_SECRET=chuoi_ngau_nhien_vua_tao_bang_openssl
COOKIE_SECURE=false
TRUST_PROXY=false

DB_PASSWORD=MotMatKhauSQLRatManh!2026
DB_NAME=MomentumDB
```

Lưu ý:

- `APP_BIND_IP` phải đúng IP LAN hiện tại của VM. Nếu IP có thể thay đổi, dùng `0.0.0.0` và giới hạn truy cập bằng firewall/router.
- Mật khẩu SQL Server phải có ít nhất 8 ký tự và gồm nhiều nhóm ký tự như chữ hoa, chữ thường, số, ký hiệu.
- Với truy cập trực tiếp bằng HTTP trong LAN, giữ `COOKIE_SECURE=false` để cookie đăng nhập hoạt động.
- Không commit hoặc gửi tệp `.env` cho người khác.

## 5. Khởi động website

```bash
sudo docker compose up -d --build
sudo docker compose ps
```

Lần đầu Docker sẽ tải image Node.js và SQL Server nên có thể mất vài phút. Container ứng dụng sẽ tự tạo database, bảng `Users`, bảng `Sessions`, rồi mới khởi động web.

Theo dõi log:

```bash
sudo docker compose logs -f app
sudo docker compose logs --tail=100 sqlserver
```

Khi `momentum-app` và `momentum-sqlserver` đều báo `healthy`, kiểm tra ngay trên VM:

```bash
curl http://127.0.0.1:3000/healthz
```

Kết quả mong đợi:

```json
{"status":"ok"}
```

## 6. Cho phép các máy trong LAN truy cập

Nếu VM chỉ nằm trong mạng nội bộ, mở cổng web:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw status
```

Thay `192.168.1.0/24` bằng dải mạng thực tế. Ví dụ:

- VM là `192.168.1.50`, các máy là `192.168.1.x` → dùng `192.168.1.0/24`.
- VM là `10.0.0.20`, các máy là `10.0.0.x` → dùng `10.0.0.0/24`.

Sau đó, từ máy khác mở:

```text
http://192.168.1.50:3000
```

Nếu VM nằm trên cloud hoặc có nhiều card mạng, cần kiểm tra thêm security group, VLAN và firewall của hypervisor. Docker có cách xử lý firewall riêng; việc đặt `APP_BIND_IP` thành IP LAN giúp tránh công khai ứng dụng ngoài card mạng mong muốn.

## 7. Vận hành

Xem trạng thái và log:

```bash
sudo docker compose ps
sudo docker compose logs -f --tail=200
```

Khởi động lại:

```bash
sudo docker compose restart
```

Cập nhật sau khi chép hoặc pull source mới:

```bash
sudo docker compose up -d --build
```

Dừng website nhưng giữ dữ liệu:

```bash
sudo docker compose down
```

Không chạy `docker compose down -v` nếu muốn giữ tài khoản người dùng, vì tùy chọn `-v` xóa volume chứa MSSQL.

## 8. Sao lưu database

Dữ liệu được giữ trong Docker volume `momentum_sql_data`. Volume giúp dữ liệu còn nguyên sau khi restart hoặc tạo lại container, nhưng không thay thế backup định kỳ.

Khi sử dụng thực tế, nên cấu hình backup `.bak` của `MomentumDB` sang một thư mục ngoài container hoặc máy lưu trữ khác. Không chỉ sao lưu riêng volume khi SQL Server đang chạy vì có thể tạo bản sao không nhất quán.

## 9. HTTPS tùy chọn

Nếu website cần truy cập ngoài LAN hoặc chứa dữ liệu thật, đặt Nginx/Caddy làm reverse proxy và dùng HTTPS. Khi đó đổi:

```dotenv
COOKIE_SECURE=true
TRUST_PROXY=true
```

Sau đó chạy lại:

```bash
sudo docker compose up -d
```
