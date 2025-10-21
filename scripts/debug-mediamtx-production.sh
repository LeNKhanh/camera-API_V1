#!/bin/bash
# MediaMTX Production Debug Script

echo "========================================="
echo "  MediaMTX Production Diagnostics"
echo "========================================="
echo ""

# Read from environment or use defaults
MEDIAMTX_HOST=${MEDIAMTX_HOST:-localhost}
MEDIAMTX_API_URL=${MEDIAMTX_API_URL:-http://localhost:9997}
MEDIAMTX_RTSP_PORT=${MEDIAMTX_RTSP_PORT:-8554}

echo "Configuration:"
echo "  MEDIAMTX_HOST=$MEDIAMTX_HOST"
echo "  MEDIAMTX_API_URL=$MEDIAMTX_API_URL"
echo "  MEDIAMTX_RTSP_PORT=$MEDIAMTX_RTSP_PORT"
echo ""

# Test 1: Check API endpoint
echo "[1/5] Testing MediaMTX API endpoint..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$MEDIAMTX_API_URL/v3/config/global/get" 2>&1)
if [ "$API_STATUS" = "200" ]; then
    echo "  ✅ API is responding (HTTP 200)"
else
    echo "  ❌ API failed (HTTP $API_STATUS)"
    echo "  Check if MediaMTX is running"
    echo "  Check if api: yes in mediamtx.yml"
fi
echo ""

# Test 2: Check RTSP port
echo "[2/5] Testing RTSP port..."
if command -v nc &> /dev/null; then
    nc -zv $MEDIAMTX_HOST $MEDIAMTX_RTSP_PORT 2>&1 | grep -q succeeded && \
        echo "  ✅ RTSP port $MEDIAMTX_RTSP_PORT is open" || \
        echo "  ❌ RTSP port $MEDIAMTX_RTSP_PORT is closed"
else
    echo "  ⚠️  netcat not available, skipping"
fi
echo ""

# Test 3: Get MediaMTX config
echo "[3/5] Getting MediaMTX configuration..."
curl -s "$MEDIAMTX_API_URL/v3/config/global/get" | jq '.' 2>/dev/null || \
    echo "  ❌ Failed to get config (jq not installed or API error)"
echo ""

# Test 4: List registered paths
echo "[4/5] Listing registered camera paths..."
PATHS=$(curl -s "$MEDIAMTX_API_URL/v3/config/paths/list" | jq '.items[] | select(.name | startswith("camera_")) | .name' 2>/dev/null)
if [ -n "$PATHS" ]; then
    echo "  Camera paths found:"
    echo "$PATHS" | while read -r path; do
        echo "    - $path"
    done
else
    echo "  ℹ️  No camera paths registered yet"
fi
echo ""

# Test 5: Check active streams
echo "[5/5] Checking active streams..."
ACTIVE=$(curl -s "$MEDIAMTX_API_URL/v3/paths/list" | jq '.items[] | select(.name | startswith("camera_")) | {name: .name, ready: .ready, readerCount: .readerCount}' 2>/dev/null)
if [ -n "$ACTIVE" ]; then
    echo "  Active streams:"
    echo "$ACTIVE"
else
    echo "  ℹ️  No active streams"
fi
echo ""

echo "========================================="
echo "  Diagnostics Complete"
echo "========================================="
echo ""
echo "Common Issues:"
echo "  - API not responding → Check if MediaMTX is running"
echo "  - api: no in config → Change to api: yes"
echo "  - Port closed → Check firewall rules"
echo "  - Cannot connect → Check MEDIAMTX_HOST domain/IP"
echo ""
