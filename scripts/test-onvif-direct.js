// Test ONVIF connection directly
const { Cam } = require('onvif');

const config = {
  hostname: '192.168.1.66',
  username: 'aidev',
  password: 'aidev123',
  port: 80, // Try: 80, 8000, 8899
  timeout: 15000,
  preserveAddress: true,
};

console.log('🔍 Testing ONVIF Connection...');
console.log('Config:', {
  hostname: config.hostname,
  username: config.username,
  password: '***',
  port: config.port,
});

const cam = new Cam(config, function (err) {
  if (err) {
    console.error('\n❌ Connection FAILED!');
    console.error('Error:', err.message);
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Login to camera web interface');
    console.error('     URL: http://192.168.1.66');
    console.error('  2. Go to: Setup > Network > ONVIF');
    console.error('  3. Verify:');
    console.error('     - ONVIF is ENABLED');
    console.error('     - Authentication is set to Digest/Basic');
    console.error('     - Port matches (default 80)');
    console.error('  4. Try creating a dedicated ONVIF user');
    console.error('  5. Try different ports: 8000, 8899, 8080');
    console.error('\n💡 For Dahua cameras:');
    console.error('   - Web interface: Setup > Network > Connection > ONVIF');
    console.error('   - Enable "ONVIF Authentication"');
    console.error('   - Port is usually 80 or 8000');
    process.exit(1);
  }

  console.log('\n✅ Connected successfully!');
  console.log('\n📊 Device Information:');
  
  cam.getDeviceInformation((err, info) => {
    if (err) {
      console.error('Failed to get device info:', err.message);
    } else {
      console.log('  - Manufacturer:', info.manufacturer);
      console.log('  - Model:', info.model);
      console.log('  - Firmware:', info.firmwareVersion);
      console.log('  - Serial:', info.serialNumber);
    }

    // Test PTZ capabilities
    console.log('\n🎥 Testing PTZ Capabilities...');
    if (cam.capabilities && cam.capabilities.PTZ) {
      console.log('  ✅ PTZ is supported!');
      
      // Try to get PTZ configuration
      if (cam.ptzService) {
        console.log('  ✅ PTZ Service available');
        
        // Test a simple PTZ move
        console.log('\n🔄 Testing ContinuousMove (PAN LEFT)...');
        cam.continuousMove(
          {
            x: -0.5, // Pan left
            y: 0,
            zoom: 0,
          },
          (err) => {
            if (err) {
              console.error('  ❌ ContinuousMove failed:', err.message);
            } else {
              console.log('  ✅ ContinuousMove command sent!');
              console.log('  📹 Camera should be moving LEFT now...');
              
              // Stop after 2 seconds
              setTimeout(() => {
                console.log('\n🛑 Sending STOP command...');
                cam.stop(
                  {
                    panTilt: true,
                    zoom: true,
                  },
                  (err) => {
                    if (err) {
                      console.error('  ❌ STOP failed:', err.message);
                    } else {
                      console.log('  ✅ STOP command sent!');
                      console.log('\n🎉 All tests PASSED!');
                      console.log('✨ ONVIF PTZ is working correctly!');
                    }
                    process.exit(0);
                  }
                );
              }, 2000);
            }
          }
        );
      } else {
        console.log('  ⚠️  PTZ Service not available');
        console.log('  This camera may not support PTZ control');
        process.exit(1);
      }
    } else {
      console.log('  ❌ PTZ NOT supported on this camera');
      console.log('  This is not a PTZ camera or PTZ is disabled');
      process.exit(1);
    }
  });
});
