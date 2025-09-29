# RECORDING (Ghi video)

Ghi một đoạn clip từ luồng RTSP bằng FFmpeg, lưu file cục bộ.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /recordings/start | Bắt đầu ghi (async) |
| GET | /recordings | Danh sách |
| GET | /recordings/:id | Chi tiết |
| PUT | /recordings/:id/stop | Dừng sớm một bản ghi RUNNING |

## Body POST
```json
{ "cameraId": "<uuid>", "durationSec": 30 }
```
`durationSec` mặc định nếu thiếu: 30 (tuỳ implement).

## Luồng cơ bản
1. Tạo record status=PENDING (ghi nhận chiến lược vào cột strategy: RTSP hoặc FAKE).
2. Chuyển RUNNING khi tiến trình bắt đầu (đưa vào map active để có thể stop).
3. Khi ffmpeg kết thúc: COMPLETED hoặc FAILED (ghi errorMessage + classify reason nếu lỗi).
4. Người dùng có thể STOP để chuyển trạng thái STOPPED (lưu endedAt & errorMessage='STOPPED_BY_USER').

## Trạng thái
| Status | Ý nghĩa |
|--------|--------|
| PENDING | Vừa tạo, tiến trình chưa spawn hoặc đang khởi tạo |
| RUNNING | Đang ghi hình |
| COMPLETED | Hoàn tất đủ thời lượng |
| FAILED | Lỗi ffmpeg hoặc kết nối |
| STOPPED | Người dùng dừng thủ công |

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -Method POST -Uri http://localhost:3000/recordings/start -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>","durationSec":10}' -ContentType 'application/json'

# Danh sách
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/recordings
```

## Trả về (start)
```json
{ "id": "...", "status": "PENDING", "storagePath": "C:/tmp/rec_x.mp4", "strategy": "RTSP" }
```

## Lỗi phổ biến
| Lỗi | Giải thích | Khắc phục |
|-----|-----------|-----------|
| 404 Camera not found | Sai cameraId | Kiểm tra id camera |
| FFMPEG_AUTH_code=1 ... | Sai user/pass | Kiểm tra credential |
| FFMPEG_CONN_code=1 ... | Không kết nối | Firewall / IP / Port |
| FFMPEG_TIMEOUT_code=1 ... | Hết thời gian kết nối | Tăng timeout hoặc kiểm tra mạng |
| FAKE_UNKNOWN ... | FFmpeg thiếu filter & fallback cũng lỗi | Kiểm tra build ffmpeg |
| STOPPED | Người dùng dừng | Bình thường |

## Ghi chú & Env liên quan
- Nên giới hạn thời lượng tối đa để tránh chiếm ổ cứng.
- Có thể chuyển sang job queue nếu cần scale (BullMQ / Redis).
- Snapshot và recording dùng thư mục: `RECORD_DIR`, `SNAPSHOT_DIR`.
- FAKE env (ghi): `FAKE_RECORD_SIZE`, `FAKE_RECORD_FPS`, `FAKE_RECORD_CODEC`, `FAKE_RECORD_QUALITY`, `FAKE_RECORD_REALTIME` (mặc định =1 bật `-re` để tạo khung hình theo thời gian thực; đặt =0 nếu muốn file sinh ra nhanh phục vụ test nhanh — lưu ý STOP khó có tác dụng vì tiến trình kết thúc gần như ngay lập tức).
- Dừng sớm: `PUT /recordings/:id/stop` chỉ áp dụng khi status RUNNING.
- Có thể thêm audio giả lập sau (anullsrc) nếu cần.
