// Test ONVIF với nhiều username possibilities
const { Cam } = require('onvif');

const credentials = [
  { user: 'aidev', pass: 'aidev123', note: 'Current credentials' },
  { user: 'admin', pass: 'aidev123', note: 'Admin user with same password' },
  { user: 'admin', pass: 'admin', note: 'Default admin' },
  { user: 'admin', pass: 'admin123', note: 'Common admin password' },
  { user: 'root', pass: 'aidev123', note: 'Root user' },
];

async function testCredential(cred) {
  return new Promise((resolve) => {
    console.log(`\n📡 Testing: ${cred.user} / ${cred.pass}`);
    console.log(`   Note: ${cred.note}`);
    
    const cam = new Cam({
      hostname: '192.168.1.66',
      username: cred.user,
      password: cred.pass,
      port: 80,
      timeout: 5000
    }, (err) => {
      if (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      } else {
        console.log(`   ✅ SUCCESS! Working credentials found!`);
        console.log(`   Device:`, cam.deviceInformation?.manufacturer, cam.deviceInformation?.model);
        
        if (cam.capabilities?.PTZ) {
          console.log(`   🎥 PTZ Capability: YES`);
        }
        
        resolve({ success: true, cam, cred });
      }
    });
  });
}

async function main() {
  console.log('============================================');
  console.log('  ONVIF Credentials Tester');
  console.log('  Camera: 192.168.1.66:80');
  console.log('============================================');

  let found = null;
  
  for (const cred of credentials) {
    const result = await testCredential(cred);
    if (result.success) {
      found = result.cred;
      console.log('\n🎉 WORKING CREDENTIALS FOUND!');
      console.log(`   Username: ${found.user}`);
      console.log(`   Password: ${found.pass}`);
      console.log('\n💡 Update your camera in database:');
      console.log(`   PATCH /cameras/:id`);
      console.log(`   { "username": "${found.user}", "password": "${found.pass}" }`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!found) {
    console.log('\n❌ No working credentials found.');
    console.log('\n💡 Solutions:');
    console.log('   1. Login to camera web interface (http://192.168.1.66)');
    console.log('   2. Go to Setup > Network > ONVIF');
    console.log('   3. Enable ONVIF authentication');
    console.log('   4. Create ONVIF user or use admin credentials');
    console.log('   5. Check ONVIF port (default 80)');
  }

  console.log('\n============================================');
}

main().catch(console.error);
