# Camera API (NestJS + PostgreSQL + FFmpeg)

Backend REST quản lý camera Dahua / snapshot / recording / event với JWT + RBAC. Sử dụng PostgreSQL + TypeORM và FFmpeg (ffmpeg-static) cho chức năng chụp ảnh & ghi nhanh. (ĐÃ CHUYỂN SANG CHUYÊN BIỆT DAHUA – loại bỏ multi-vendor filters.)

## Thành phần chính
- NestJS Modules: Auth, Camera (Dahua-only), Snapshot, Recording, Event, Stream (stub), PTZ Friendly.
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
## Đăng nhập nhanh
- Sau khi seed: username `admin` / password `admin123`
- Gọi POST /auth/login -> nhận `accessToken`
- Đính kèm `Authorization: Bearer <token>` cho các API còn lại

## API chính (tóm tắt)
Auth:
- POST /auth/login
- POST /auth/register (dev)
 - POST /auth/refresh (body: userId, refreshToken) – cấp mới access + refresh (rotate)
 - POST /auth/logout (body: userId) – xoá refresh token (revoke)

 Camera (Dahua-only + Multi-Channel):
 - CRUD: /cameras (mỗi record = một channel trên thiết bị IP)
 - Bulk create nhiều channel: POST /cameras/bulk-channels { ipAddress, port, username, password, channels }
 - Auto-increment channel nếu IP đã tồn tại (quy tắc MỚI: luôn gán channel = MAX(channel hiện có cùng IP) + 1, không lấp khoảng trống)
 - Verify RTSP: GET /cameras/:id/verify (OK / AUTH / TIMEOUT / CONN / NOT_FOUND)
 - Bộ lọc: enabled, name, channel, createdFrom/createdTo, pagination (page,pageSize), sortBy=createdAt|name, sortDir

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
	- Mapping speed → vector pan/tilt/zoom (trả về trường vector)
	- Throttle (mặc định 200ms, ENV: PTZ_THROTTLE_MS; debug: PTZ_THROTTLE_DEBUG=1 trả lastDeltaMs)
	- Ghi log lịch sử vào bảng ptz_logs (giữ tối đa 5 log gần nhất cho mỗi cặp (ILoginID,nChannelID) – ENV: PTZ_LOG_MAX)

Legacy NetSDK module: (ĐÃ GỠ BỎ) trước đây mô phỏng PTZ kiểu session/handle.

### Tài liệu chi tiết theo chức năng
- Auth: `docs/AUTH.md`
- Camera: `docs/CAMERA.md`
- Snapshot cơ bản: `docs/SNAPSHOT.md`
- Snapshot nâng cao: `docs/ADVANCED_SNAPSHOT.md`
- Recording: `docs/RECORDING.md`
- Event: `docs/EVENT.md`
- Stream (stub): `docs/STREAM.md`
## Lược đồ ngắn gọn
Entities chính: users, cameras (có channel), snapshots, recordings, events.
Mở rộng thêm: cameras.vendor, cameras.sdk_port; recordings.status (PENDING→RUNNING→COMPLETED/FAILED); ptz_logs (lịch sử PTZ, vector & speed) và retention tự động (ptz_logs dùng cặp trường ILoginID, nChannelID thay cho camera_id trước đây).

## Cấu trúc codebase (Architecture Overview)
```text
src/
	main.ts                # Bootstrap + listen (có logic auto-port nếu bật)
	data-source.ts         # (Nếu dùng TypeORM CLI / migrations async)
	seeds/                 # Script seed dữ liệu (user admin, mẫu camera...)
	common/
		roles.decorator.ts   # @Roles(...)
		roles.guard.ts       # Kiểm tra role từ JWT payload
	modules/
		app.module.ts        # Gắn kết tất cả module
		app.controller.ts    # /health, endpoint phụ
		auth/                # Đăng ký / đăng nhập / JWT
			auth.controller.ts
			auth.service.ts
			auth.module.ts
			jwt.strategy.ts     # Parse & verify Bearer token
		guards/
			jwt.guard.ts        # Áp dụng Passport strategy 'jwt'
		camera/
			camera.controller.ts
			camera.service.ts   # CRUD + filter nâng cao + verify RTSP + IP validate
			camera.module.ts
		snapshot/
			snapshot.controller.ts
			snapshot.service.ts # Capture (RTSP/FAKE), retry, phân loại lỗi
			snapshot.module.ts
		recording/
			recording.controller.ts
			recording.service.ts# Start/Stop (RTSP/FAKE), pacing, download
			recording.module.ts
		event/
			event.controller.ts # CRUD + ack + simulate-motion
			event.service.ts
			event.module.ts
		stream/
			stream.controller.ts# Trả URL stub (HLS/DASH)
			stream.service.ts
			stream.module.ts
        # (netsdk/ đã xoá – dùng PTZ friendly duy nhất)
		ptz/                  # PTZ Friendly API (abstract hoá tốc độ / vector)
			ptz.controller.ts
			ptz.service.ts      # Speed→vector, throttle, log, prune
			ptz.module.ts
	typeorm/
		entities/
			user.entity.ts      # users (auth + role)
		camera.entity.ts    # cameras (RTSP info, vendor, channel multi-channel)
			snapshot.entity.ts  # snapshots (đường dẫn file, time)
			recording.entity.ts # recordings (file, status, strategy)
			event.entity.ts     # events (type, ack, camera)
			ptz-log.entity.ts   # ptz_logs (ILoginID, nChannelID, action, vector, speed, timestamp)
	migrations/             # (Sẽ sinh khi bật migration flow)

docs/                    
```

### Luồng chính (request → response)
1. Client gửi HTTP request kèm `Authorization: Bearer <JWT>` (trừ /auth/login, /auth/register)
2. `JwtAuthGuard` xác thực token (header) → parse payload → `req.user`
3. (Nếu route có @Roles) `RolesGuard` lọc theo vai trò
4. Controller nhận DTO (class-validator) → gọi Service
5. Service thao tác DB qua TypeORM Repo / hoặc gọi FFmpeg / logic khác
6. Kết quả trả về JSON (tối giản, không lộ mật khẩu hoặc đường dẫn nội bộ nếu không cần)

### Ghi chú kiến trúc
- Module hoá rõ ràng: dễ bật/tắt hoặc tách microservice sau này.
- Service không import ngược lẫn nhau để tránh vòng lặp (chỉ ngoại lệ nếu dùng injection tokens).
- Entity giữ logic tối thiểu (anemic model) → Business nằm ở service.
- PTZ friendly thay thế hẳn module NetSDK legacy (đã xoá) → sau này có thể thêm adapter ONVIF.
- Tất cả thao tác nặng (ffmpeg, retry snapshot) được bao trong service chuyên dụng để tránh controller phình to.
- Pagination chỉ bật khi có query `page` hoặc `pageSize` để giữ backward compatibility.
- ENV kiểm soát hành vi (throttle, timeout, fake mode) giúp dev dễ test offline.

### Hướng mở rộng
- Thêm `SwaggerModule` tự sinh OpenAPI docs.
- Thêm `@nestjs/config` + schema validation cho ENV.
- (ĐÃ LÀM) Migration thay đổi ptz_logs: bỏ camera_id, thêm ILoginID (UUID camera tại thời điểm log) & nChannelID.
	- Lý do: Chuẩn bị tương lai ánh xạ sang handle SDK hoặc login session abstraction; tránh FK cứng khi cần log cả lệnh trước khi camera entity tồn tại/hoặc sau khi bị xoá.
	- Mapping hiện tại: ILoginID = camera.id, nChannelID = camera.channel.
- Adapter PTZ Dahua/ONVIF thật (thay thế logic giả). 
- Module lưu trữ S3/MinIO cho snapshot/recording.
- WebSocket / SSE push realtime events & PTZ feedback.
- Cơ chế audit log / soft delete.

### Biến môi trường quan trọng (tham khảo nhanh)
| ENV | Mô tả | Mặc định |
|-----|-------|----------|
| CAMERA_VERIFY_TIMEOUT_MS | Timeout verify RTSP | 4000 |
| SNAPSHOT_DIR | Thư mục lưu snapshot | ./snapshots |
| RECORD_DIR | Thư mục lưu recording | ./recordings |
| SNAPSHOT_CACHE_RTSP | Bật cache RTSP snapshot | 0 |
| SNAPSHOT_CACHE_OVERRIDE | Ghi đè file cache nếu có | 0 |
| PTZ_THROTTLE_MS | Khoảng cách tối thiểu giữa 2 lệnh PTZ (ms) | 200 |
| PTZ_THROTTLE_DEBUG | 1: trả thêm lastDeltaMs | 0 |
| PTZ_LOG_MAX | Số log PTZ tối đa mỗi camera | 5 |
| AUTO_PORT | 1: tự động tìm port trống nếu 3000 bận | 0 |
| REFRESH_TOKEN_TTL_SEC | TTL refresh token (giây) | 604800 |

> Ghi chú: Production nên tắt `synchronize` và dùng migrations để đảm bảo schema ổn định.

## Bảo mật & RBAC
JWT + RolesGuard với vai trò ADMIN / OPERATOR / VIEWER.

## Khắc phục nhanh
- Thiếu package: `npm install`
- Postgres không kết nối: kiểm tra DB_HOST / firewall
- Snapshot fail: bật `DEBUG_SNAPSHOT=1` và xem advanced doc
- PowerShell policy: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
## Quy trình test nhanh (rút gọn)
1) `npm run seed` → đăng nhập admin (POST /auth/login trả về accessToken + refreshToken)
2) Tạo camera (`POST /cameras`)
3) Chụp snapshot (`POST /snapshots/capture`)
4) Bắt đầu ghi (`POST /recordings/start`)
5) Tạo event (`POST /events`)
6) Xem danh sách (GET /cameras /snapshots /recordings /events)
Chi tiết snapshot nâng cao & xử lý lỗi xem `docs/ADVANCED_SNAPSHOT.md`.
### 10) Gợi ý test kịch bản end-to-end
1) Login admin → tạo camera RTSP thật → snapshot → recording 30s → tạo event → list tất cả → check DB → xoá camera → xác nhận cascade xóa bản ghi liên quan.
2) Login viewer → xác nhận chỉ GET được, POST/PATCH/DELETE bị 403. Test refresh: /auth/refresh -> nhận cặp token mới; dùng token cũ sau logout phải 401.
3) Đổi STREAM_BASE_URL và thử GET stream URL.

---

## PTZ nội bộ (mock)
Giới hạn hiện tại:
- "login" chỉ tạo handle giả lập, không thật sự kết nối SDK.
- PTZ trả về JSON xác nhận lệnh; không gửi tới thiết bị thật.
- Snapshot qua SDK bị vô hiệu (trả lỗi `SNAPSHOT_UNSUPPORTED_NO_SDK`). Bạn vẫn có thể dùng RTSP + FFmpeg snapshot trong module `snapshot`.

### Thay đổi schema ptz_logs (IMPORTANT)
Phiên bản mới đã refactor bảng `ptz_logs`:

| Trường | Trước | Nay | Ghi chú |
|--------|-------|-----|---------|
| camera_id | UUID FK -> cameras | (BỎ) | Loại bỏ FK trực tiếp |
| ILoginID | (không có) | UUID | Lưu id camera tại thời điểm ghi log (tạm ánh xạ 1-1 camera.id) |
| nChannelID | (không có) | int | Channel tương ứng camera.channel |

Các trường action, speed, vector_pan/tilt/zoom, duration_ms, created_at giữ nguyên ý nghĩa.

Retention hiện thực thi trên từng cặp (ILoginID, nChannelID). ENV `PTZ_LOG_MAX` áp dụng cho mỗi cặp này.

Migration áp dụng (ví dụ):
1. Thêm cột ILoginID, nChannelID (nullable)
2. Backfill từ camera_id & cameras.channel
3. Drop camera_id
4. Đặt NOT NULL + index (nếu cần tối ưu)

Nếu bạn nâng cấp từ phiên bản cũ dùng camera_id: chạy `npm run migration:run` để áp dụng thay đổi. Không cần manual script bổ sung.

Lưu ý: Mặc dù hiện tại ILoginID == camera.id, trong tương lai có thể thay bằng giá trị login session/handle thực từ SDK. Ứng dụng client không nên dựa vào FK ràng buộc mà chỉ đọc các field này như metadata.



