# CAMERA (Quản lý Camera)

## Mục tiêu
CRUD thông tin camera Dahua đa kênh (multi-channel): IP, SDK port (37777), credential, RTSP port, trạng thái, channel. (Vendor cố định 'dahua'). Mỗi dòng trong bảng `cameras` đại diện một channel trên cùng thiết bị nếu cùng `ipAddress`.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| GET | /cameras | Danh sách |
| GET | /cameras/:id | Chi tiết |
| POST | /cameras | Tạo mới (channel đơn) |
| POST | /cameras/bulk-channels | Tạo nhiều channel cho cùng IP |
| PATCH | /cameras/:id | Cập nhật |
| DELETE | /cameras/:id | Xoá |
| GET | /cameras/:id/verify | Kiểm tra nhanh kết nối RTSP (ffmpeg ping) |

## Thuộc tính chính (body POST – Dahua Only)
```json
{
  "name": "Kho 1",
  "ipAddress": "192.168.1.10",
  "port": 37777,
  "username": "admin",
  "password": "Abc12345",
  "rtspPort": 554,
  "enabled": true,
  "channel": 2
}
```
Tùy chọn: codec, resolution, rtspUrl (override). Vendor auto = "dahua".

QUY TẮC GÁN CHANNEL (mới): Nếu không gửi `channel` hoặc gửi giá trị đã bị chiếm trên cùng `ipAddress`, hệ thống sẽ lấy MAX(channel) hiện có của IP đó và gán `channel = max + 1` (tăng tuần tự, không điền vào khoảng trống). Điều này đơn giản hóa suy luận channel khi có xoá giữa chừng.

### Bulk create
```json
{
  "name": "NVR",
  "ipAddress": "192.168.1.10",
  "port": 37777,
  "username": "admin",
  "password": "Abc12345",
  "channels": 8
}
```
Tạo tối đa N record channel (1..N). Channel đã tồn tại sẽ bị bỏ qua (bỏ duplicate). Trả về mảng camera được tạo mới.

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select-Object -ExpandProperty accessToken

# Tạo camera
curl -Method POST -Uri http://localhost:3000/cameras -Headers @{Authorization="Bearer $token"} -Body '{"name":"Kho 1","ipAddress":"192.168.1.10","username":"u","password":"p","rtspPort":554}' -ContentType 'application/json'

# Danh sách
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/cameras

# Lọc theo enabled=true
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/cameras?enabled=true"

# Tìm theo tên chứa 'Kho'
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/cameras?name=Kho"

# (ĐÃ BỎ) vendor / vendors filter vì project chuyên Dahua

# Date range (ISO hoặc yyyy-mm-dd)
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/cameras?createdFrom=2025-09-01&createdTo=2025-09-29"

# Pagination + sort (trang 2, mỗi trang 5, sort theo name ASC)
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/cameras?page=2&pageSize=5&sortBy=name&sortDir=ASC"

# Cập nhật
curl -Method PATCH -Uri http://localhost:3000/cameras/<id> -Headers @{Authorization="Bearer $token"} -Body '{"enabled":false}' -ContentType 'application/json'

# Xoá
curl -Method DELETE -Uri http://localhost:3000/cameras/<id> -Headers @{Authorization="Bearer $token"}
```

## Tham số query mở rộng (/cameras)
| Param | Kiểu | Ví dụ | Mô tả |
|-------|------|-------|-------|
| enabled | boolean | enabled=true | Lọc theo trạng thái bật/tắt |
| name | string | name=Kho | Tên chứa chuỗi (LIKE, không phân biệt hoa thường) |
| channel | number | channel=3 | Lọc đúng channel |
| createdFrom | date/ISO | createdFrom=2025-09-01 | Lọc tạo từ ngày (>=) |
| createdTo | date/ISO | createdTo=2025-09-29 | Lọc tạo đến ngày (<=) |
| page | number | page=2 | Trang (>=1) – kích hoạt pagination nếu kèm pageSize |
| pageSize | number | pageSize=10 | Số phần tử mỗi trang (tối đa 100) |
| sortBy | enum | sortBy=name | createdAt | name (mặc định createdAt) |
| sortDir | enum | sortDir=ASC | ASC | DESC (mặc định DESC) |

Quy tắc:
- Nếu không truyền cả page và pageSize → trả về MẢNG đơn thuần (giữ tương thích cũ).
- Nếu truyền page & pageSize hợp lệ → trả về OBJECT có `data` + `pagination`.
- Bỏ tham số vendor / vendors (cố định Dahua).
- Channel auto tăng nếu không gửi hoặc gửi channel đã chiếm → hệ thống gán channel tiếp theo còn trống.

### Ví dụ request kết hợp
```
/cameras?enabled=true&vendors=dahua,hikvision&name=Kho&page=1&pageSize=5&sortBy=name&sortDir=ASC&createdFrom=2025-09-01
```

### Ví dụ response (có pagination)
```json
{
  "data": [
  { "id": "...", "name": "Kho 1", "enabled": true, "createdAt": "2025-09-29T09:00:00.000Z" }
  ],
  "pagination": { "page": 1, "pageSize": 5, "total": 12, "totalPages": 3 },
  "sort": { "sortBy": "name", "sortDir": "ASC" },
  "filtersApplied": { "enabled": true, "name": "Kho", "vendor": "dahua,hikvision", "createdFrom": "2025-09-01T00:00:00.000Z", "createdTo": null }
}
```

### Ví dụ response (không pagination)
```json
[
  { "id": "...", "name": "Kho 1", "enabled": true },
  { "id": "...", "name": "Kho 2", "enabled": true }
]
```

## Verify RTSP – phân loại trạng thái
Endpoint: `GET /cameras/:id/verify`

| status | Ý nghĩa | Gợi ý |
|--------|---------|-------|
| OK | Bắt được 1 frame thành công | Kết nối tốt |
| AUTH | Sai user/pass hoặc 401 | Kiểm tra credential |
| TIMEOUT | Hết thời gian chờ | Kiểm tra mạng / IP / port |
| CONN | Lỗi kết nối (refused / unreachable) | Kiểm tra firewall / routing |
| NOT_FOUND | Stream hoặc đường dẫn không tồn tại | Kiểm tra đường dẫn RTSP |
| UNKNOWN | Khác (chung chung) | Xem stderr / log chi tiết |

Timeout cấu hình qua biến môi trường: `CAMERA_VERIFY_TIMEOUT_MS` (mặc định 4000 ms).

## Ghi chú tương thích
- Thay đổi này KHÔNG phá vỡ client cũ: không dùng pagination → format cũ.
- Khi nâng cấp client mới: nên kiểm tra nếu response là mảng hay object để xử lý pagination UI.
- Có thể thêm CSV export / cache trong tương lai.

## Lỗi thường gặp
| Mã | Ý nghĩa | Gợi ý |
|----|---------|-------|
| 404 | Không tìm thấy id | Kiểm tra lại id |
| 409 | (giảm khả năng xảy ra) ip_address + channel trùng khi race condition | Thử lại, hệ thống cố gắng auto-increment |
| 400 | Invalid IP address format | Kiểm tra IPv4/IPv6 hợp lệ |

## Ghi chú
- Nên mã hoá (hoặc tối thiểu mask) credential khi log.
- Có thể bổ sung field health/trạng thái kết nối sau.
- IP validation: hỗ trợ IPv4 chặt (0-255 mỗi octet) & IPv6 (rút gọn ::). Sai định dạng trả 400.
- Composite unique: (ipAddress, channel) đảm bảo một channel không trùng trên cùng IP.
- /cameras/:id/verify dùng ffmpeg: mở RTSP TCP, lấy 1 frame trong ~timeout (CAMERA_VERIFY_TIMEOUT_MS, mặc định 4000ms) và phân loại: OK / TIMEOUT / AUTH / CONN / NOT_FOUND / UNKNOWN.

### Ví dụ verify
```powershell
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/cameras/<id>/verify
```
Kết quả mẫu:
```json
{ "ok": true, "status": "OK", "rtsp": "rtsp://admin:admin@192.168.1.10:554", "ms": 812 }
```
Lỗi auth mẫu:
```json
{ "ok": false, "status": "AUTH", "ms": 1030 }
```
