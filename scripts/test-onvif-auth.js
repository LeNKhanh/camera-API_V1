// Test ONVIF connection với nhiều authentication methods
const { Cam } = require('onvif');

const configs = [
  {
    name: 'Default Auth',
    options: {
      hostname: '192.168.1.66',
      username: 'aidev',
      password: 'aidev123',
      port: 80,
      timeout: 5000
    }
  },
  {
    name: 'Port 8000',
    options: {
      hostname: '192.168.1.66',
      username: 'aidev',
      password: 'aidev123',
      port: 8000,
      timeout: 5000
    }
  },
  {
    name: 'Port 8899',
    options: {
      hostname: '192.168.1.66',
      username: 'aidev',
      password: 'aidev123',
      port: 8899,
      timeout: 5000
    }
  },
  {
    name: 'With preserveAddress',
    options: {
      hostname: '192.168.1.66',
      username: 'aidev',
      password: 'aidev123',
      port: 80,
      timeout: 5000,
      preserveAddress: true
    }
  }
];

async function testConnection(config) {
  return new Promise((resolve) => {
    console.log(`\n📡 Testing: ${config.name}`);
    console.log(`   Config:`, JSON.stringify(config.options, null, 2));
    
    const cam = new Cam(config.options, (err) => {
      if (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      } else {
        console.log(`   ✅ SUCCESS!`);
        console.log(`   Device Info:`, cam.deviceInformation);
        console.log(`   Capabilities:`, Object.keys(cam.capabilities || {}));
        
        // Test PTZ
        if (cam.capabilities && cam.capabilities.PTZ) {
          console.log(`   🎥 PTZ Available!`);
        }
        
        resolve({ success: true, cam });
      }
    });
  });
}

async function main() {
  console.log('============================================');
  console.log('  ONVIF Connection Tester');
  console.log('  Camera: 192.168.1.66');
  console.log('  User: aidev / aidev123');
  console.log('============================================');

  for (const config of configs) {
    const result = await testConnection(config);
    if (result.success) {
      console.log('\n🎉 Found working configuration!');
      console.log('Use this config in your app.');
      break;
    }
    await new Promise(r => setTimeout(r, 1000)); // Wait 1s between tests
  }

  console.log('\n============================================');
  console.log('Test completed');
  console.log('============================================');
}

main().catch(console.error);
