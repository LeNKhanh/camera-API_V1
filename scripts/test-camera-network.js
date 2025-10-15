#!/usr/bin/env node
/**
 * Test network connectivity to camera from production server
 * Chạy script này trên production để kiểm tra có thể kết nối tới camera không
 */

const { exec } = require('child_process');
const net = require('net');

const CAMERA_IP = process.env.CAMERA_IP || '192.168.1.66';
const ONVIF_PORT = parseInt(process.env.ONVIF_PORT || '80');
const TIMEOUT = 5000;

console.log('🔍 Testing camera network connectivity...');
console.log(`📍 Target: ${CAMERA_IP}:${ONVIF_PORT}`);
console.log('');

// Test 1: Ping
console.log('Test 1: Ping camera...');
exec(`ping -c 4 ${CAMERA_IP}`, (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Ping failed:', error.message);
  } else {
    console.log('✅ Ping successful:');
    console.log(stdout);
  }
  console.log('');
  
  // Test 2: TCP connection
  console.log(`Test 2: TCP connect to ${CAMERA_IP}:${ONVIF_PORT}...`);
  const socket = new net.Socket();
  
  socket.setTimeout(TIMEOUT);
  
  socket.on('connect', () => {
    console.log(`✅ TCP connection successful to ${CAMERA_IP}:${ONVIF_PORT}`);
    socket.destroy();
    testOnvif();
  });
  
  socket.on('timeout', () => {
    console.log(`❌ TCP connection timeout after ${TIMEOUT}ms`);
    socket.destroy();
    showTroubleshooting();
  });
  
  socket.on('error', (err) => {
    console.log(`❌ TCP connection failed: ${err.message}`);
    showTroubleshooting();
  });
  
  socket.connect(ONVIF_PORT, CAMERA_IP);
});

// Test 3: ONVIF GetDeviceInformation
async function testOnvif() {
  console.log('');
  console.log('Test 3: ONVIF GetDeviceInformation...');
  
  try {
    const { Cam } = require('onvif');
    
    const cam = new Cam(
      {
        hostname: CAMERA_IP,
        username: process.env.CAMERA_USERNAME || 'aidev',
        password: process.env.CAMERA_PASSWORD || 'Aidev@123',
        port: ONVIF_PORT,
        timeout: TIMEOUT,
      },
      (err) => {
        if (err) {
          console.log('❌ ONVIF connection failed:', err.message);
          showTroubleshooting();
          return;
        }
        
        console.log('✅ ONVIF connection successful!');
        console.log('📷 Camera info:');
        console.log('   - Manufacturer:', cam.deviceInformation?.manufacturer || 'unknown');
        console.log('   - Model:', cam.deviceInformation?.model || 'unknown');
        console.log('   - Firmware:', cam.deviceInformation?.firmwareVersion || 'unknown');
        console.log('');
        console.log('✅ Camera is accessible from this server!');
        console.log('💡 ONVIF PTZ should work.');
      }
    );
  } catch (error) {
    console.log('❌ ONVIF test failed:', error.message);
    showTroubleshooting();
  }
}

function showTroubleshooting() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('❌ CAMERA NOT ACCESSIBLE FROM PRODUCTION SERVER');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🔧 Possible solutions:');
  console.log('');
  console.log('1️⃣  VPN/Tunnel to camera network:');
  console.log('   - Use VPN to connect production server to camera LAN');
  console.log('   - Or use reverse SSH tunnel');
  console.log('');
  console.log('2️⃣  Port forwarding:');
  console.log('   - Forward camera ONVIF port to public IP');
  console.log('   - Update CAMERA_IP in .env to public IP');
  console.log('');
  console.log('3️⃣  Deploy on same network:');
  console.log('   - Deploy app on server in same LAN as camera');
  console.log('   - Or use edge device (Raspberry Pi, NUC)');
  console.log('');
  console.log('4️⃣  Use HTTP API instead:');
  console.log('   - Disable ONVIF: PTZ_USE_ONVIF=0');
  console.log('   - Use vendor HTTP API (Dahua CGI)');
  console.log('   - Set up port forwarding for HTTP API');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  process.exit(1);
}
