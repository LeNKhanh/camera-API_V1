# Advanced Snapshot Logic

Tài liệu này tách phần nâng cao khỏi README chính để README gọn và dễ đọc hơn.

## Mục tiêu
Cơ chế snapshot được thiết kế để:
- Hoạt động được cả khi chưa biết chính xác RTSP path.
- Thử nhiều cổng / nhiều pattern vendor (Hikvision, Dahua, Onvif, generic).
- Phân loại lỗi để dev biết thất bại vì kết nối, auth hay timeout.
- Có chế độ FAKE để phát triển offline.
- Có watchdog tránh ffmpeg treo.
- Có cache tự động URL hoạt động.

## Chiến lược (strategy)
| Strategy       | Mô tả | Ghi chú |
|----------------|------|--------|
| RTSP (mặc định)| Chụp qua FFmpeg từ luồng RTSP | Dò nhiều ứng viên nếu chưa có rtspUrl trong DB |
| FAKE           | Tạo ảnh synthetic (testsrc/test pattern) | Không cần camera thật, dùng cho dev frontend |
| SDK_NETWORK    | Placeholder future | Hiện fallback sang RTSP nếu ENABLE_SDK_SNAPSHOT!=1 |
| SDK_LOCAL      | Placeholder future | Như trên |

## Thứ tự dựng danh sách RTSP Candidates
1. Nếu body có `rtspUrl` → chỉ dùng 1 URL đó.
2. Else nếu camera có cột `rtspUrl` → chỉ dùng URL này.
3. Else build từ username/password/ip/rtspPort (vendor-aware) + ALT_RTSP_PORTS.

Vendor heuristic (ví dụ):
- Hikvision: `/Streaming/Channels/101`, `/Streaming/Channels/102`
- Dahua: `/cam/realmonitor?channel=1&subtype=0..2`
- Onvif: `/onvif-media/media.amp`
- Generic luôn thêm: `/live`, `/`

## Fallback cổng RTSP
ENV: `ALT_RTSP_PORTS=8554,10554` → hợp nhất cùng cổng chính `rtspPort` tạo danh sách thử.

## Tham số ffmpeg chính
```
-rtsp_transport tcp | udp
-rtsp_flags prefer_tcp (khi tcp)
-stimeout <microseconds> (nếu build hỗ trợ)
-analyzeduration <value>
-probesize <value>
-frames:v 1
-q:v 2
```

`SNAPSHOT_TIMEOUT_MS` → chuyển sang microseconds cho `-stimeout`.
Nếu phát hiện stderr chứa "Unrecognized option 'stimeout'" → ghi nhớ và bỏ ở lần sau.

## Watchdog
`SNAPSHOT_HARD_TIMEOUT_MS` (default 15000). Nếu tiến trình chưa thoát → kill và reject với lỗi watchdog.

## UDP Fallback
Nếu TCP fail và `SNAPSHOT_FALLBACK_UDP=1` → thử lại với `-rtsp_transport udp`. Nếu xuất hiện lỗi stimeout không hỗ trợ ở bước này cũng lặp lại logic bỏ flag.

## Phân loại lỗi
Regex trên stderr: AUTH / TIMEOUT / CONN / NOT_FOUND / FORMAT / PERMISSION / UNKNOWN.
Tổng hợp tất cả lỗi các candidate khi thất bại: `SNAPSHOT_CAPTURE_FAILED:ALL_CANDIDATES_FAILED <reason:url;...>`.

## Auto Cache RTSP
ENV:
- `SNAPSHOT_CACHE_RTSP=1`: bật lưu candidate thành công vào `camera.rtspUrl`.
- `SNAPSHOT_CACHE_OVERRIDE=1`: cho phép ghi đè giá trị hiện tại.

## FAKE Strategy
Không cần camera thật.
ENV tùy chọn:
- `FAKE_SNAPSHOT_SIZE` (vd 1024x576, fallback 1280x720 nếu sai)
- `FAKE_SNAPSHOT_QUALITY` (mặc định 2 – càng lớn càng mờ)
- `FAKE_SNAPSHOT_BG` (màu cho fallback filter color, vd black|white|red|#112233)

Thử lần lượt filter: `testsrc2` → `testsrc` → `color`.
Nếu cả 3 fail → trả `SNAPSHOT_FAKE_FAILED`.

## Ví dụ Request
```json
POST /snapshots/capture
{
  "cameraId": "<uuid>",
  "strategy": "RTSP",
  "filename": "opt.jpg"
}
```

Override tạm thời:
```json
{
  "cameraId": "<uuid>",
  "rtspUrl": "rtsp://user:pass@192.168.1.10:554/Streaming/Channels/101"
}
```

FAKE:
```json
{
  "cameraId": "<uuid>",
  "strategy": "FAKE",
  "filename": "fake1.jpg"
}
```

## Env Biến Snapshot
| Biến | Ý nghĩa | Ghi chú |
|------|---------|---------|
| SNAPSHOT_DIR | Thư mục lưu file ảnh | Mặc định hệ temp |
| SNAPSHOT_TIMEOUT_MS | Timeout logic (ms) cho -stimeout | Default 10000 |
| SNAPSHOT_HARD_TIMEOUT_MS | Watchdog kill nếu vượt (ms) | Default 15000 |
| SNAPSHOT_ANALYZE_US | Giá trị cho -analyzeduration | Default 500000 |
| SNAPSHOT_PROBESIZE | Giá trị cho -probesize | Default 500000 |
| SNAPSHOT_FALLBACK_UDP | 1 bật thử UDP nếu TCP fail | 0 hoặc unset = tắt |
| ALT_RTSP_PORTS | Danh sách cổng phụ | Chuỗi CSV |
| SNAPSHOT_CACHE_RTSP | 1 bật cache url thành công |  |
| SNAPSHOT_CACHE_OVERRIDE | 1 cho phép ghi đè url hiện có |  |
| DEBUG_SNAPSHOT | 1 in log debug chi tiết | Không bật ở prod |
| FAKE_SNAPSHOT_SIZE | Kích thước ảnh fake | 1280x720 fallback |
| FAKE_SNAPSHOT_QUALITY | Chất lượng JPG (2 tốt) | 2..31 |
| FAKE_SNAPSHOT_BG | Màu fallback filter color | black |
| ENABLE_SDK_SNAPSHOT | 1 bật route strategy SDK mock | Fallback RTSP |

## Ghi chú Bảo trì
- Tránh thêm quá nhiều candidate path sẽ làm tăng thời gian chờ tổng.
- Có thể bổ sung cache từng vendor đã thử để giảm lần sau.
- Nên thêm structured logger (winston/pino) nếu triển khai prod.

## mở rộng
1. Lưu snapshot vào object storage thay vì local.
2. Thêm API phục vụ trực tiếp file ảnh qua HTTP (hiện chỉ trả metadata path).
3. Thêm retry schedule async thay vì blocking request nếu cần.

---