#!/bin/bash
# Script to update MediaMTX config on production server

echo "Updating MediaMTX configuration..."

# Backup current config
docker exec mediamtx cp /mediamtx.yml /mediamtx.yml.backup
echo "✓ Backup created"

# Update apiAddress to allow external connections
docker exec mediamtx sed -i 's/apiAddress: 127.0.0.1:9997/apiAddress: 0.0.0.0:9997/' /mediamtx.yml
echo "✓ Config updated"

# Verify change
echo ""
echo "Verifying config:"
docker exec mediamtx cat /mediamtx.yml | grep -A 2 "^api:"

# Restart MediaMTX
echo ""
echo "Restarting MediaMTX..."
docker restart mediamtx

# Wait for restart
sleep 5

# Check logs
echo ""
echo "Checking logs:"
docker logs mediamtx --tail 10

echo ""
echo "✓ Done! MediaMTX should now accept API calls from other containers."
echo ""
echo "Test with:"
echo "docker exec <API_CONTAINER> curl http://mediamtx:9997/v3/config/global/get"
