# Camera API Documentation

BASE URL: https://camera-api.teknix.services

---

## Table of Contents

1. Authentication
2. User Management
3. Camera Management
4. Stream Management
5. Snapshot Management
6. PTZ Control
7. Recording Management
8. Roles and Permissions

---

## 1. Authentication

### 1.1 Register User

POST https://camera-api.teknix.services/auth/register

Request Body:
```
{
  "username": "admin",
  "password": "admin123",
  "role": "ADMIN"
}
```

Response 201:
```
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "role": "ADMIN",
  "createdAt": "2025-10-27T03:00:00.000Z"
}
```

Note: Role must be one of: ADMIN, OPERATOR, VIEWER

---

### 1.2 Login

POST https://camera-api.teknix.services/auth/login

Request Body:
```
{
  "username": "admin",
  "password": "admin123"
}
```

Response 200:
```
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

---

### 1.3 Refresh Token

POST https://camera-api.teknix.services/auth/refresh

Request Body:
```
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response 200:
```
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 1.4 Logout

POST https://camera-api.teknix.services/auth/logout

Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Request Body:
```
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response 200:
```
{
  "message": "Logged out successfully"
}
```

---

## 2. User Management

All endpoints require Authentication header

Headers for all requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 2.1 Get Profile

GET https://camera-api.teknix.services/users/profile

Roles: ADMIN, OPERATOR, VIEWER

Response 200:
```
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "role": "ADMIN",
  "createdAt": "2025-10-27T03:00:00.000Z"
}
```

---

### 2.2 List Users

GET https://camera-api.teknix.services/users

Roles: ADMIN only

Query Parameters (all optional):
- username: string - filter by username (partial match)
- role: string - filter by role (ADMIN,OPERATOR,VIEWER)
- createdFrom: string - filter by created date from (ISO 8601)
- createdTo: string - filter by created date to (ISO 8601)
- page: number - page number (default 1)
- pageSize: number - items per page (default 10, max 100)
- sortBy: string - sort field (username, createdAt, role)
- sortDir: string - sort direction (ASC, DESC)

Example Request:
```
GET https://camera-api.teknix.services/users?role=OPERATOR&page=1&pageSize=10&sortBy=createdAt&sortDir=DESC
```

Response 200:
```
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "operator1",
      "role": "OPERATOR",
      "createdAt": "2025-10-27T03:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "operator2",
      "role": "OPERATOR",
      "createdAt": "2025-10-26T03:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  },
  "sort": {
    "sortBy": "createdAt",
    "sortDir": "DESC"
  },
  "filtersApplied": {
    "username": null,
    "role": "OPERATOR",
    "createdFrom": null,
    "createdTo": null
  }
}
```

---

### 2.3 Update User

PUT https://camera-api.teknix.services/users/:id

Roles: ADMIN only

Request Body (all fields optional):
```
{
  "password": "newpassword123",
  "role": "OPERATOR"
}
```

Response 200:
```
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "user1",
  "role": "OPERATOR",
  "createdAt": "2025-10-27T03:00:00.000Z"
}
```

---

### 2.4 Delete User

DELETE https://camera-api.teknix.services/users/:id

Roles: ADMIN only

Response 200:
```
{
  "message": "User deleted successfully"
}
```

---

## 3. Camera Management

All endpoints require Authentication header

---

### 3.1 Create Camera

POST https://camera-api.teknix.services/cameras

Roles: ADMIN, OPERATOR

Request Body - Example 1 (Channel 1):
```
{
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 1,
  "username": "aidev",
  "password": "aidev123",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua",
  "codec": "H.264",
  "resolution": "1080p"
}
```

Request Body - Example 2 (Channel 2 with PTZ):
```
{
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 2,
  "username": "aidev",
  "password": "aidev123",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua",
  "codec": "H.264",
  "resolution": "1080p"
}
```

Response 201:
```
{
  "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 2,
  "username": "aidev",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua",
  "codec": "H.264",
  "resolution": "1080p",
  "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "onvifUrl": "http://192.168.1.66:80/onvif/device_service",
  "createdAt": "2025-10-27T03:00:00.000Z",
  "updatedAt": "2025-10-27T03:00:00.000Z"
}
```

Note: Password is not returned in response

---

### 3.2 List Cameras

GET https://camera-api.teknix.services/cameras

Roles: ADMIN, OPERATOR, VIEWER

Query Parameters (all optional):
- enabled: boolean - filter by enabled status (true, false)
- name: string - filter by name (partial match)
- ipAddress: string - filter by IP address (exact match)
- channel: number - filter by channel
- createdFrom: string - filter by created date from (ISO 8601)
- createdTo: string - filter by created date to (ISO 8601)
- page: number - page number
- pageSize: number - items per page (max 100)
- sortBy: string - sort field (createdAt, name)
- sortDir: string - sort direction (ASC, DESC)

Example Request:
```
GET https://camera-api.teknix.services/cameras?enabled=true&ipAddress=192.168.1.66&page=1&pageSize=10
```

Response 200:
```
{
  "data": [
    {
      "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
      "name": "aidev ptz cam",
      "ipAddress": "192.168.1.66",
      "channel": 1,
      "username": "aidev",
      "sdkPort": 37777,
      "onvifPort": 80,
      "rtspPort": 554,
      "enabled": true,
      "vendor": "dahua",
      "codec": "H.264",
      "resolution": "1080p",
      "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=1&subtype=0",
      "onvifUrl": "http://192.168.1.66:80/onvif/device_service",
      "createdAt": "2025-10-27T03:00:00.000Z",
      "updatedAt": "2025-10-27T03:00:00.000Z"
    },
    {
      "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac8",
      "name": "aidev ptz cam",
      "ipAddress": "192.168.1.66",
      "channel": 2,
      "username": "aidev",
      "sdkPort": 37777,
      "onvifPort": 80,
      "rtspPort": 554,
      "enabled": true,
      "vendor": "dahua",
      "codec": "H.264",
      "resolution": "1080p",
      "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
      "onvifUrl": "http://192.168.1.66:80/onvif/device_service",
      "createdAt": "2025-10-27T03:00:00.000Z",
      "updatedAt": "2025-10-27T03:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  },
  "sort": {
    "sortBy": "createdAt",
    "sortDir": "DESC"
  },
  "filtersApplied": {
    "enabled": true,
    "name": null,
    "ipAddress": "192.168.1.66",
    "channel": null,
    "createdFrom": null,
    "createdTo": null
  }
}
```

---

### 3.3 Get Camera Details

GET https://camera-api.teknix.services/cameras/:id

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/cameras/49e77c80-af6e-4ac6-b0ea-b4f018dacac7
```

Response 200:
```
{
  "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 2,
  "username": "aidev",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua",
  "codec": "H.264",
  "resolution": "1080p",
  "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "onvifUrl": "http://192.168.1.66:80/onvif/device_service",
  "createdAt": "2025-10-27T03:00:00.000Z",
  "updatedAt": "2025-10-27T03:00:00.000Z"
}
```

---

### 3.4 Update Camera

PATCH https://camera-api.teknix.services/cameras/:id

Roles: ADMIN, OPERATOR

Request Body (all fields optional):
```
{
  "name": "aidev ptz cam updated",
  "enabled": false,
  "resolution": "4K"
}
```

Response 200:
```
{
  "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "name": "aidev ptz cam updated",
  "ipAddress": "192.168.1.66",
  "channel": 2,
  "username": "aidev",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": false,
  "vendor": "dahua",
  "codec": "H.264",
  "resolution": "4K",
  "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "onvifUrl": "http://192.168.1.66:80/onvif/device_service",
  "createdAt": "2025-10-27T03:00:00.000Z",
  "updatedAt": "2025-10-27T04:00:00.000Z"
}
```

---

### 3.5 Delete Camera

DELETE https://camera-api.teknix.services/cameras/:id

Roles: ADMIN only

Response 200:
```
{
  "message": "Camera deleted successfully"
}
```

---

### 3.6 Verify Camera Connection

GET https://camera-api.teknix.services/cameras/:id/verify

Roles: ADMIN, OPERATOR, VIEWER

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "status": "online",
  "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "message": "Camera is reachable"
}
```

---

### 3.7 Bulk Create Cameras

POST https://camera-api.teknix.services/cameras/bulk-channels

Roles: ADMIN, OPERATOR

Request Body:
```
{
  "ipAddress": "192.168.1.66",
  "username": "aidev",
  "password": "aidev123",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "channels": 2,
  "namePrefix": "aidev ptz cam"
}
```

Response 201:
```
{
  "message": "Created 2 cameras successfully",
  "cameras": [
    {
      "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
      "name": "aidev ptz cam - Channel 1",
      "channel": 1
    },
    {
      "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac8",
      "name": "aidev ptz cam - Channel 2",
      "channel": 2
    }
  ]
}
```

---

## 4. Stream Management

All endpoints require Authentication header

---

### 4.1 Get Stream URL

GET https://camera-api.teknix.services/streams/:cameraId/url

Roles: ADMIN, OPERATOR, VIEWER

Query Parameters:
- protocol: string - HLS or DASH (default HLS)

Example Request:
```
GET https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/url?protocol=HLS
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "protocol": "HLS",
  "streamUrl": "https://camera-api.teknix.services/hls/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/index.m3u8"
}
```

---

### 4.2 Get Direct RTSP URL

GET https://camera-api.teknix.services/streams/:cameraId/rtsp

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/rtsp
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "rtspUrl": "rtsp://192.168.1.66:554/cam/realmonitor?channel=2&subtype=0",
  "username": "aidev",
  "note": "Use this URL with VLC or FFmpeg. Password not included for security."
}
```

---

### 4.3 Get Proxy Stream URL

GET https://camera-api.teknix.services/streams/:cameraId/proxy

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/streams/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/proxy
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "proxyUrl": "rtsp://mediamtx.teknix.services:8554/camera/49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "hlsUrl": "https://mediamtx.teknix.services/camera/49e77c80-af6e-4ac6-b0ea-b4f018dacac7/index.m3u8",
  "note": "Camera IP hidden via MediaMTX proxy"
}
```

---

## 5. Snapshot Management

All endpoints require Authentication header

---

### 5.1 Capture Snapshot

POST https://camera-api.teknix.services/snapshots/capture

Roles: ADMIN, OPERATOR

Request Body:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "filename": "snapshot-2025-10-27.jpg"
}
```

Response 201:
```
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "filename": "snapshot-2025-10-27.jpg",
  "storagePath": "https://iotek.tn-cdn.net/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg",
  "capturedAt": "2025-10-27T03:00:00.000Z",
  "fileSize": 245678,
  "width": 1920,
  "height": 1080
}
```

---

### 5.2 Capture Snapshot via Network SDK

POST https://camera-api.teknix.services/snapshots/capture/network

Roles: ADMIN, OPERATOR

Request Body:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "filename": "snapshot-network-2025-10-27.jpg"
}
```

Response 201:
```
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae8",
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "filename": "snapshot-network-2025-10-27.jpg",
  "storagePath": "https://iotek.tn-cdn.net/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae8.jpg",
  "capturedAt": "2025-10-27T03:00:00.000Z",
  "fileSize": 245678,
  "strategy": "SDK_NETWORK"
}
```

---

### 5.3 List Snapshots

GET https://camera-api.teknix.services/snapshots

Roles: ADMIN, OPERATOR, VIEWER

Query Parameters (optional):
- cameraId: string - filter by camera ID

Example Request:
```
GET https://camera-api.teknix.services/snapshots?cameraId=49e77c80-af6e-4ac6-b0ea-b4f018dacac7
```

Response 200:
```
{
  "snapshots": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
      "filename": "snapshot-2025-10-27.jpg",
      "storagePath": "https://iotek.tn-cdn.net/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg",
      "capturedAt": "2025-10-27T03:00:00.000Z",
      "fileSize": 245678
    },
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae8",
      "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
      "filename": "snapshot-network-2025-10-27.jpg",
      "storagePath": "https://iotek.tn-cdn.net/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae8.jpg",
      "capturedAt": "2025-10-27T03:00:00.000Z",
      "fileSize": 245678
    }
  ],
  "total": 2
}
```

---

### 5.4 Get Snapshot Details

GET https://camera-api.teknix.services/snapshots/:id

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

Response 200:
```
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "camera": {
    "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
    "name": "aidev ptz cam",
    "ipAddress": "192.168.1.66",
    "channel": 2
  },
  "filename": "snapshot-2025-10-27.jpg",
  "storagePath": "https://iotek.tn-cdn.net/snapshots/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg",
  "capturedAt": "2025-10-27T03:00:00.000Z",
  "fileSize": 245678,
  "width": 1920,
  "height": 1080
}
```

---

### 5.5 Delete Snapshot

DELETE https://camera-api.teknix.services/snapshots/:id

Roles: ADMIN, OPERATOR

Response 200:
```
{
  "message": "Snapshot deleted successfully"
}
```

---

## 6. PTZ Control

All endpoints require Authentication header

Note: PTZ control only works on Channel 2 (49e77c80-af6e-4ac6-b0ea-b4f018dacac8)

---

### 6.1 Execute PTZ Command

POST https://camera-api.teknix.services/cameras/:id/ptz

Roles: ADMIN, OPERATOR

Available Actions:
- PAN_LEFT, PAN_RIGHT
- TILT_UP, TILT_DOWN
- PAN_LEFT_UP, PAN_RIGHT_UP, PAN_LEFT_DOWN, PAN_RIGHT_DOWN
- ZOOM_IN, ZOOM_OUT
- FOCUS_NEAR, FOCUS_FAR
- IRIS_OPEN, IRIS_CLOSE
- PRESET_GOTO, PRESET_SET, PRESET_DELETE
- AUTO_SCAN_START, AUTO_SCAN_STOP
- PATTERN_START, PATTERN_STOP, PATTERN_RUN
- TOUR_START, TOUR_STOP
- STOP

Request Body - Example 1 (Pan Left):
```
{
  "action": "PAN_LEFT",
  "speed": 5,
  "durationMs": 2000
}
```

Request Body - Example 2 (Zoom In):
```
{
  "action": "ZOOM_IN",
  "speed": 3,
  "durationMs": 1000
}
```

Request Body - Example 3 (Go to Preset):
```
{
  "action": "PRESET_GOTO",
  "param1": 1
}
```

Request Body - Example 4 (Set Preset):
```
{
  "action": "PRESET_SET",
  "param1": 1
}
```

Request Body - Example 5 (Stop Movement):
```
{
  "action": "STOP"
}
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac8",
  "action": "PAN_LEFT",
  "speed": 5,
  "status": "success",
  "method": "ONVIF",
  "timestamp": "2025-10-27T03:00:00.000Z",
  "durationMs": 2000
}
```

---

### 6.2 Get PTZ Status

GET https://camera-api.teknix.services/cameras/:id/ptz/status

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/cameras/49e77c80-af6e-4ac6-b0ea-b4f018dacac8/ptz/status
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac8",
  "active": true,
  "currentAction": "PAN_LEFT",
  "startedAt": "2025-10-27T03:00:00.000Z",
  "lastCommand": {
    "action": "PAN_LEFT",
    "speed": 5,
    "timestamp": "2025-10-27T03:00:00.000Z"
  }
}
```

---

### 6.3 Get PTZ Command Logs

GET https://camera-api.teknix.services/cameras/:id/ptz/logs

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/cameras/49e77c80-af6e-4ac6-b0ea-b4f018dacac8/ptz/logs
```

Response 200:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac8",
  "logs": [
    {
      "id": "8c9e6679-7425-40de-944b-e07fc1f90ae9",
      "action": "PAN_LEFT",
      "speed": 5,
      "param1": null,
      "param2": null,
      "param3": null,
      "status": "success",
      "errorMessage": null,
      "executedAt": "2025-10-27T03:00:00.000Z"
    },
    {
      "id": "8c9e6679-7425-40de-944b-e07fc1f90ae8",
      "action": "ZOOM_IN",
      "speed": 3,
      "param1": null,
      "param2": null,
      "param3": null,
      "status": "success",
      "errorMessage": null,
      "executedAt": "2025-10-27T02:59:00.000Z"
    }
  ],
  "total": 2
}
```

---

## 7. Recording Management

All endpoints require Authentication header

---

### 7.1 Start Recording

POST https://camera-api.teknix.services/recordings/start

Roles: ADMIN, OPERATOR

Request Body:
```
{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "durationSec": 30,
  "filename": "recording-2025-10-27.mp4"
}
```

Response 201:
```
{
  "id": "9c9e6679-7425-40de-944b-e07fc1f90aea",
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "status": "RECORDING",
  "filename": "recording-2025-10-27.mp4",
  "startedAt": "2025-10-27T03:00:00.000Z",
  "durationSec": 30,
  "estimatedEndAt": "2025-10-27T03:00:30.000Z"
}
```

---

### 7.2 List Recordings

GET https://camera-api.teknix.services/recordings

Roles: ADMIN, OPERATOR, VIEWER

Query Parameters (all optional):
- cameraId: string - filter by camera ID
- status: string - filter by status (PENDING, RECORDING, COMPLETED, FAILED)
- from: string - filter by start date from (ISO 8601)
- to: string - filter by start date to (ISO 8601)

Example Request:
```
GET https://camera-api.teknix.services/recordings?cameraId=49e77c80-af6e-4ac6-b0ea-b4f018dacac7&status=COMPLETED
```

Response 200:
```
{
  "recordings": [
    {
      "id": "9c9e6679-7425-40de-944b-e07fc1f90aea",
      "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
      "camera": {
        "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
        "name": "aidev ptz cam",
        "ipAddress": "192.168.1.66",
        "channel": 2
      },
      "status": "COMPLETED",
      "filename": "recording-2025-10-27.mp4",
      "startedAt": "2025-10-27T03:00:00.000Z",
      "endedAt": "2025-10-27T03:00:30.000Z",
      "durationSec": 30,
      "fileSize": 5242880,
      "storagePath": "https://iotek.tn-cdn.net/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea.mp4"
    }
  ],
  "total": 1
}
```

---

### 7.3 Get Recording Details

GET https://camera-api.teknix.services/recordings/:id

Roles: ADMIN, OPERATOR, VIEWER

Example Request:
```
GET https://camera-api.teknix.services/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea
```

Response 200:
```
{
  "id": "9c9e6679-7425-40de-944b-e07fc1f90aea",
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "camera": {
    "id": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
    "name": "aidev ptz cam",
    "ipAddress": "192.168.1.66",
    "channel": 2
  },
  "status": "COMPLETED",
  "filename": "recording-2025-10-27.mp4",
  "startedAt": "2025-10-27T03:00:00.000Z",
  "endedAt": "2025-10-27T03:00:30.000Z",
  "durationSec": 30,
  "fileSize": 5242880,
  "storagePath": "https://iotek.tn-cdn.net/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea.mp4",
  "codec": "H.264",
  "resolution": "1080p"
}
```

---

### 7.4 Stop Recording

PUT https://camera-api.teknix.services/recordings/:id/stop

Roles: ADMIN, OPERATOR

Response 200:
```
{
  "id": "9c9e6679-7425-40de-944b-e07fc1f90aea",
  "status": "COMPLETED",
  "message": "Recording stopped successfully",
  "startedAt": "2025-10-27T03:00:00.000Z",
  "endedAt": "2025-10-27T03:00:15.000Z",
  "actualDuration": 15,
  "storagePath": "https://iotek.tn-cdn.net/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea.mp4"
}
```

---

### 7.5 Download Recording

GET https://camera-api.teknix.services/recordings/:id/download

Roles: ADMIN, OPERATOR

Example Request:
```
GET https://camera-api.teknix.services/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea/download
```

Response 302:
Redirects to R2 public URL:
```
https://iotek.tn-cdn.net/recordings/9c9e6679-7425-40de-944b-e07fc1f90aea.mp4
```

---

## 8. Roles and Permissions

### Role Hierarchy

1. ADMIN
   - Full access to all endpoints
   - Can create, update, delete users
   - Can create, update, delete cameras
   - Can control PTZ
   - Can start/stop recordings
   - Can capture snapshots
   - Can view all data

2. OPERATOR
   - Can create, update cameras (cannot delete)
   - Can control PTZ
   - Can start/stop recordings
   - Can capture snapshots
   - Can view all data
   - Cannot manage users

3. VIEWER
   - Can view cameras
   - Can view recordings
   - Can view snapshots
   - Can view PTZ status and logs
   - Can view stream URLs
   - Cannot create, update, or delete
   - Cannot control PTZ
   - Cannot start recordings
   - Cannot capture snapshots

---

## Quick Start Guide

### Step 1: Register Admin User

POST https://camera-api.teknix.services/auth/register
```
{
  "username": "admin",
  "password": "admin123",
  "role": "ADMIN"
}
```

### Step 2: Login

POST https://camera-api.teknix.services/auth/login
```
{
  "username": "admin",
  "password": "admin123"
}
```

Save the accessToken from response

### Step 3: Create Camera (Channel 1)

POST https://camera-api.teknix.services/cameras
Headers: Authorization Bearer YOUR_ACCESS_TOKEN
```
{
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 1,
  "username": "aidev",
  "password": "aidev123",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua"
}
```

### Step 4: Create Camera (Channel 2 with PTZ)

POST https://camera-api.teknix.services/cameras
Headers: Authorization Bearer YOUR_ACCESS_TOKEN
```
{
  "name": "aidev ptz cam",
  "ipAddress": "192.168.1.66",
  "channel": 2,
  "username": "aidev",
  "password": "aidev123",
  "sdkPort": 37777,
  "onvifPort": 80,
  "rtspPort": 554,
  "enabled": true,
  "vendor": "dahua"
}
```

Save the camera ID for Channel 2 (for PTZ control)

### Step 5: Test PTZ Control (Channel 2 only)

POST https://camera-api.teknix.services/cameras/CHANNEL_2_CAMERA_ID/ptz
Headers: Authorization Bearer YOUR_ACCESS_TOKEN
```
{
  "action": "PAN_LEFT",
  "speed": 5,
  "durationMs": 2000
}
```

### Step 6: Capture Snapshot

POST https://camera-api.teknix.services/snapshots/capture
Headers: Authorization Bearer YOUR_ACCESS_TOKEN
```
{
  "cameraId": "CAMERA_ID",
  "filename": "test-snapshot.jpg"
}
```

### Step 7: Start Recording

POST https://camera-api.teknix.services/recordings/start
Headers: Authorization Bearer YOUR_ACCESS_TOKEN
```
{
  "cameraId": "CAMERA_ID",
  "durationSec": 30,
  "filename": "test-recording.mp4"
}
```

### Step 8: Get Stream URL

GET https://camera-api.teknix.services/streams/CAMERA_ID/url?protocol=HLS
Headers: Authorization Bearer YOUR_ACCESS_TOKEN

---

## Error Responses

### 400 Bad Request
```
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "username should not be empty",
    "password must be at least 6 characters"
  ]
}
```

### 401 Unauthorized
```
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```
{
  "statusCode": 404,
  "message": "Camera not found"
}
```

### 500 Internal Server Error
```
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Error details"
}
```

---

## Notes

1. All timestamps are in ISO 8601 format (UTC)
2. All UUIDs are version 4
3. File sizes are in bytes
4. Passwords are never returned in responses
5. Access tokens expire after 15 minutes
6. Refresh tokens expire after 7 days
7. PTZ control only works on cameras with PTZ capability (Channel 2 in this example)
8. Maximum recording duration is 3600 seconds (1 hour)
9. Supported video codecs: H.264, H.265
10. Supported resolutions: 720p, 1080p, 4K

---

## Support

For issues or questions, contact: support@teknix.services
