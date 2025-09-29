# Camera API (NestJS + PostgreSQL + FFmpeg)

Backend REST quản lý camera / snapshot / recording / event với JWT + RBAC. Sử dụng PostgreSQL + TypeORM và FFmpeg (ffmpeg-static) cho chức năng chụp ảnh & ghi nhanh. 

## Thành phần chính
- NestJS Modules: Auth, Camera, Snapshot, Recording, Event, Stream (stub), NetSDK (mock PTZ).
- PostgreSQL + TypeORM (migrations, UUID PK).
- FFmpeg (ffmpeg-static) cho snapshot & recording cơ bản.
- JWT + RolesGuard (ADMIN / OPERATOR / VIEWER).
- (Tuỳ chọn mở rộng) Lưu trữ object (S3/MinIO) thay vì local.

## Yêu cầu hệ thống
- Node.js >= 18
- PostgreSQL 14+ (đã cài pgcrypto để có gen_random_uuid) hoặc bật extension tương đương
- FFmpeg trong PATH (hoặc dùng gói ffmpeg-static đi kèm)
- Windows PowerShell v5.1 (theo môi trường người dùng)

## Cài đặt nhanh
1) Cài dependencies
```powershell
npm install
```

2) Tạo file .env từ mẫu và chỉnh thông số
```powershell
Copy-Item src\.env.example .env
```

3) Tạo DB bằng pgAdmin 4
- Tạo database `Camera_api` (hoặc tên khác, nhớ sửa .env)
- Đảm bảo extension `uuid-ossp` hoặc `pgcrypto` có sẵn (để tạo UUID). Có thể chạy lệnh: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

4) Seed tài khoản admin
```powershell
npm run seed
```

5) Chạy dev
```powershell
npm run start:dev
```
API chạy tại http://localhost:3000

## Database & Migration

1) Biến môi trường DB (trong `.env`)

```properties
DB_HOST=localhost
DB_PORT=5432
```

2) Tạo DB và extension (tuỳ chọn chạy bằng psql)

```sql
-- Tạo database nếu chưa có
CREATE DATABASE "Camera_api";

-- Bật extension UUID (chạy trong database Camera_api)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Hoặc dùng pgcrypto nếu bạn thích
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

3) Chạy migration (khuyến nghị cho môi trường staging/production)

```powershell
# Sinh migration khi thay đổi entity (nếu cần)
npm run migration:generate

# Áp dụng migration vào DB hiện tại
npm run migration:run
```

Ghi chú:
- Ở môi trường dev bạn có thể để `synchronize=true` cho nhanh, nhưng production nên tắt và chỉ dùng migration.
- Nếu PowerShell chặn script, xem mục "Khắc phục sự cố" để bật RemoteSigned hoặc dùng cmd.exe.

## Đăng nhập nhanh
- Sau khi seed: username `admin` / password `admin123`
- Gọi POST /auth/login -> nhận `accessToken`
- Đính kèm `Authorization: Bearer <token>` cho các API còn lại

## API chính (tóm tắt)
Auth:
- POST /auth/login
- POST /auth/register (dev)

Camera:
- CRUD: /cameras
- Verify kết nối RTSP: GET /cameras/:id/verify (ffmpeg thử bắt 1 frame, phân loại OK / AUTH / TIMEOUT / CONN / NOT_FOUND)

Snapshot:
- POST /snapshots/capture (strategy mặc định RTSP, có FAKE để dev offline)
- GET /snapshots, /snapshots/:id

Recording:
- POST /recordings/start (strategy RTSP|FAKE)
- PUT /recordings/:id/stop (dừng sớm)
- GET /recordings?cameraId=&from=&to= (lọc)
- GET /recordings/:id
- GET /recordings/:id/download (tải file)

Event:
- CRUD cơ bản /events
- PUT /events/:id/ack (đánh dấu đã xử lý)
- POST /events/simulate-motion/:cameraId (giả lập MOTION)

Stream (stub):
- GET /streams/:cameraId/url?protocol=HLS|DASH (trả URL mô phỏng)

PTZ Friendly:
- POST /cameras/:id/ptz (PAN_LEFT | PAN_RIGHT | TILT_UP | TILT_DOWN | ZOOM_IN | ZOOM_OUT | STOP)
- GET /cameras/:id/ptz/status

NetSDK (legacy mock PTZ):
- POST /netsdk/sessions, GET /netsdk/sessions, GET /netsdk/sessions/:handle
- PUT /netsdk/sessions/:handle/ptz
- DELETE /netsdk/sessions/:handle
- POST /netsdk/sessions/:handle/snapshots (hiện báo không hỗ trợ)

### Tài liệu chi tiết theo chức năng
- Auth: `docs/AUTH.md`
- Camera: `docs/CAMERA.md`
- Snapshot cơ bản: `docs/SNAPSHOT.md`
- Snapshot nâng cao: `docs/ADVANCED_SNAPSHOT.md`
- Recording: `docs/RECORDING.md`
- Event: `docs/EVENT.md`
- Stream (stub): `docs/STREAM.md`

Lưu ý: Stream cần hạ tầng streaming thực tế (SRS/nginx-rtmp/HLS segmenter); service hiện trả về URL mẫu.

## Lược đồ ngắn gọn
Entities chính: users, cameras, snapshots, recordings, events.
Mở rộng thêm: cameras.vendor, cameras.sdk_port; recordings.status (PENDING→RUNNING→COMPLETED/FAILED).

## Ghi chú triển khai
- Dev bật synchronize=true; Prod dùng migrations.
- FFmpeg: đã bundle ffmpeg-static. Đặt `SNAPSHOT_DIR`, `RECORD_DIR` là thư mục tồn tại.
- Auto-cache RTSP (tùy chọn): `SNAPSHOT_CACHE_RTSP=1` (+ `SNAPSHOT_CACHE_OVERRIDE=1` nếu muốn ghi đè).
- Logic snapshot nâng cao: xem `docs/ADVANCED_SNAPSHOT.md`.
- Camera IP validation: kiểm tra chặt IPv4 & IPv6; sai định dạng trả 400.
- Endpoint /cameras/:id/verify: dùng ffmpeg kiểm tra reachability nhanh (timeout tùy `CAMERA_VERIFY_TIMEOUT_MS`).

## Bảo mật & RBAC
JWT + RolesGuard với vai trò ADMIN / OPERATOR / VIEWER.

## Khắc phục nhanh
- Thiếu package: `npm install`
- Postgres không kết nối: kiểm tra DB_HOST / firewall
- Snapshot fail: bật `DEBUG_SNAPSHOT=1` và xem advanced doc
- PowerShell policy: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
## Quy trình test nhanh (rút gọn)
1) `npm run seed` → đăng nhập admin (POST /auth/login)
2) Tạo camera (`POST /cameras`)
3) Chụp snapshot (`POST /snapshots/capture`)
4) Bắt đầu ghi (`POST /recordings/start`)
5) Tạo event (`POST /events`)
6) Xem danh sách (GET /cameras /snapshots /recordings /events)
Chi tiết snapshot nâng cao & xử lý lỗi xem `docs/ADVANCED_SNAPSHOT.md`.
### 10) Gợi ý test kịch bản end-to-end
1) Login admin → tạo camera RTSP thật → snapshot → recording 30s → tạo event → list tất cả → check DB → xoá camera → xác nhận cascade xóa bản ghi liên quan.
2) Login viewer → xác nhận chỉ GET được, POST/PATCH/DELETE bị 403.
3) Đổi STREAM_BASE_URL và thử GET stream URL.

---

## PTZ nội bộ (mock)

Trước đây phần này mô tả tích hợp NetSDK thông qua một "bridge" native. Hiện tại dự án đã loại bỏ phụ thuộc bridge để giữ mọi thứ thuần REST + TypeScript. Module `netsdk` giờ chỉ cung cấp các endpoint mô phỏng login và PTZ ở mức logic, lưu phiên (session) trong bộ nhớ, phục vụ cho việc tích hợp UI hoặc kiểm thử luồng quyền hạn.

Giới hạn hiện tại:
- "login" chỉ tạo handle giả lập, không thật sự kết nối SDK.
- PTZ trả về JSON xác nhận lệnh; không gửi tới thiết bị thật.
- Snapshot qua SDK bị vô hiệu (trả lỗi `SNAPSHOT_UNSUPPORTED_NO_SDK`). Bạn vẫn có thể dùng RTSP + FFmpeg snapshot trong module `snapshot`.

Endpoints REST hiện tại (JWT + RBAC):
- POST /netsdk/sessions { ip, port, username, password } → tạo session (handle)
- GET /netsdk/sessions → liệt kê tất cả session trong bộ nhớ
- GET /netsdk/sessions/:handle → chi tiết 1 session
- DELETE /netsdk/sessions/:handle → logout (huỷ session)
- PUT /netsdk/sessions/:handle/ptz { channel, cmd, p1?, p2?, p3?, stop? } → lệnh PTZ giả lập
- POST /netsdk/sessions/:handle/snapshots { channel, filePath } → hiện trả `{ ok:false, error: 'SNAPSHOT_UNSUPPORTED_NO_SDK' }`

Định hướng mở rộng (nếu cần thật sự nói chuyện với thiết bị):
1) Tích hợp ONVIF: dùng thư viện onvif để thực hiện PTZ/snapshot thật. Thay logic giả lập trong `NetSdkService` bằng gọi ONVIF profile.
2) Viết adapter SDK riêng bằng Node-API (C++ addon) hoặc quay lại mô hình bridge nếu cần hiệu năng cao.
3) Thêm persistent store cho sessions (Redis) nếu muốn scale nhiều instance.

Muốn PTZ thật: tích hợp ONVIF hoặc SDK native riêng (xem advanced docs nếu bổ sung sau).

