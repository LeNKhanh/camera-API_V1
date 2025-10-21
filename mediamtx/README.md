# MediaMTX RTSP Proxy Server

## What is this?

MediaMTX is an RTSP proxy server that hides your camera IPs and credentials from end users.

## Directory Structure

```
mediamtx/
├── mediamtx.yml          # Configuration file
├── mediamtx.exe          # Windows executable (download separately)
├── mediamtx              # Linux executable (download separately)
└── README.md             # This file
```

## Quick Start

### 1. Download MediaMTX

#### Windows:
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_windows_amd64.zip" -OutFile "mediamtx.zip"

# Extract to this folder
Expand-Archive mediamtx.zip -DestinationPath . -Force

# Cleanup
Remove-Item mediamtx.zip
```

#### Linux (Production):
```bash
cd mediamtx
wget https://github.com/bluenviron/mediamtx/releases/download/v1.5.0/mediamtx_v1.5.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.5.0_linux_amd64.tar.gz
rm mediamtx_v1.5.0_linux_amd64.tar.gz
chmod +x mediamtx
```

### 2. Run MediaMTX

#### Windows (Development):
```powershell
cd mediamtx
.\mediamtx.exe mediamtx.yml
```

#### Linux (Production):
```bash
cd mediamtx
./mediamtx mediamtx.yml
```

### 3. Test with VLC

```
rtsp://localhost:8554/camera_49e77c80
```

## Ports

- **8554**: RTSP (for VLC, FFmpeg)
- **8888**: HLS (for browsers)
- **8889**: WebRTC (ultra-low latency)
- **9997**: API (management)

## Configuration

Edit `mediamtx.yml` to:
- Add new cameras
- Enable authentication
- Configure recording
- Adjust performance settings

## Production Deployment

See `../docs/COOLIFY-MEDIAMTX-SETUP.md` for complete production setup guide.
