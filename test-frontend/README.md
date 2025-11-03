# Camera API Test Frontend

Next.js frontend để test Camera API streaming endpoints.

## Chạy Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend sẽ chạy trên: http://localhost:3333

## Tính Năng

- ✅ Test các API endpoints với SSO authentication
- ✅ HLS video player với hls.js
- ✅ Display API responses
- ✅ Error handling và logging
- ✅ CORS-friendly (port 3333 đã được whitelist)

## Endpoints Được Test

1. `GET /streams/:cameraId/proxy` - Không có protocol param
2. `GET /streams/:cameraId/proxy?protocol=HLS` - Có protocol param (FE đang dùng)
3. `GET /streams/:cameraId/url?protocol=HLS` - Endpoint khác
4. `GET /cameras` - List tất cả cameras

## Configuration

File `config.ts` chứa:
- SSO Token (valid until Nov 9, 2025)
- API Base URL (production)
- Test Camera ID

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- hls.js (HLS streaming)
