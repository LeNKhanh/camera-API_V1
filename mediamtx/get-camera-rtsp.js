#!/usr/bin/env node
/**
 * MediaMTX runOnDemand Script
 * 
 * This script is called by MediaMTX when a client requests a camera stream.
 * It fetches the real camera RTSP URL from the Camera API database
 * and outputs it to stdout for MediaMTX to proxy.
 * 
 * Usage by MediaMTX: node get-camera-rtsp.js camera_49e77c80
 */

const { Pool } = require('pg');
const path = require('path');

// Get camera path from command line argument
const cameraPath = process.argv[2]; // e.g., "camera_49e77c80"

if (!cameraPath) {
  console.error('Error: Camera path not provided');
  process.exit(1);
}

// Extract camera ID pattern from path
// Format: camera_XXXXXXXX where XXXXXXXX is first 8 chars of UUID
const pathMatch = cameraPath.match(/^camera_(.+)$/);
if (!pathMatch) {
  console.error(`Error: Invalid camera path format: ${cameraPath}`);
  process.exit(1);
}

const cameraIdPrefix = pathMatch[1]; // e.g., "49e77c80"

// Database connection (read from environment or use defaults)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'Camera_api',
});

async function getCameraRtspUrl() {
  let client;
  
  try {
    client = await pool.connect();
    
    // Query camera by ID prefix (first 8 chars)
    // Cast UUID to text for LIKE comparison
    const query = `
      SELECT id, name, ip_address, rtsp_port, username, password, channel, rtsp_url
      FROM cameras
      WHERE id::text LIKE $1
      LIMIT 1
    `;
    
    const result = await client.query(query, [`${cameraIdPrefix}%`]);
    
    if (result.rows.length === 0) {
      console.error(`Error: Camera not found with ID prefix: ${cameraIdPrefix}`);
      process.exit(1);
    }
    
    const camera = result.rows[0];
    let rtspUrl;
    
    // Use custom RTSP URL if available, otherwise build from camera config
    if (camera.rtsp_url && camera.rtsp_url.trim().length > 0) {
      rtspUrl = camera.rtsp_url;
    } else {
      // Build RTSP URL for Dahua cameras
      const username = camera.username || 'admin';
      const password = camera.password || 'admin';
      const ip = camera.ip_address;
      const port = camera.rtsp_port || 554;
      const channel = camera.channel || 1;
      
      // Dahua RTSP format
      rtspUrl = `rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`;
    }
    
    // Output RTSP URL to stdout for MediaMTX
    // MediaMTX will read this and use it as the source
    console.log(rtspUrl);
    
    // Log to stderr for debugging (won't interfere with MediaMTX)
    console.error(`[MediaMTX] Camera ${camera.name} (${camera.id}) -> ${camera.ip_address}:${camera.rtsp_port || 554}/channel${camera.channel}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`Error fetching camera RTSP URL: ${error.message}`);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run
getCameraRtspUrl();
