/**
 * Test ONVIF PTZ - Detailed Diagnostics
 * Kiểm tra chi tiết khả năng PTZ của camera
 */

const onvif = require('onvif');

const CAMERA_CONFIG = {
  hostname: '192.168.1.66',
  username: 'aidev',
  password: 'aidev123',
  port: 80,
  timeout: 15000,
  preserveAddress: true,
  autoconnect: true,
};

console.log('🔍 ONVIF PTZ Detailed Diagnostics');
console.log('================================\n');

const cam = new onvif.Cam(CAMERA_CONFIG, async (err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  console.log('✅ Connected to camera');
  console.log('📷 Device:', cam.deviceInformation?.manufacturer, cam.deviceInformation?.model);
  console.log('');

  // 1. List all profiles
  console.log('📋 Profiles:');
  if (cam.profiles && cam.profiles.length > 0) {
    cam.profiles.forEach((profile, index) => {
      console.log(`\n  Profile ${index + 1}:`);
      console.log(`    Name: ${profile.name}`);
      console.log(`    Token: ${profile.token}`);
      
      if (profile.PTZConfiguration) {
        console.log(`    ✅ Has PTZ Configuration:`);
        console.log(`      - Node Token: ${profile.PTZConfiguration.nodeToken}`);
        console.log(`      - Name: ${profile.PTZConfiguration.name}`);
        console.log(`      - Token: ${profile.PTZConfiguration.token}`);
      } else {
        console.log(`    ❌ No PTZ Configuration`);
      }
    });
  }
  console.log('\n');

  // 2. Get PTZ Nodes
  console.log('🎮 PTZ Nodes:');
  cam.getNodes((err, nodes) => {
    if (err) {
      console.log('  ❌ Cannot get nodes:', err.message);
    } else if (nodes && nodes.length > 0) {
      nodes.forEach((node, i) => {
        console.log(`\n  Node ${i + 1}:`);
        console.log(`    Token: ${node.$.token}`);
        console.log(`    Name: ${node.name}`);
        
        if (node.supportedPTZSpaces) {
          console.log(`    Supported Spaces:`);
          if (node.supportedPTZSpaces.absolutePanTiltPositionSpace) {
            console.log(`      ✅ AbsolutePosition`);
          }
          if (node.supportedPTZSpaces.relativePanTiltTranslationSpace) {
            console.log(`      ✅ RelativeTranslation`);
          }
          if (node.supportedPTZSpaces.continuousPanTiltVelocitySpace) {
            console.log(`      ✅ ContinuousVelocity`);
          }
        }
      });
    } else {
      console.log('  ℹ️  No PTZ nodes found');
    }
    console.log('\n');

    // 3. Get PTZ Configuration
    console.log('⚙️  PTZ Configurations:');
    cam.getConfigurations((err, configs) => {
      if (err) {
        console.log('  ❌ Cannot get configurations:', err.message);
      } else if (configs && configs.length > 0) {
        configs.forEach((config, i) => {
          console.log(`\n  Config ${i + 1}:`);
          console.log(`    Name: ${config.name}`);
          console.log(`    Token: ${config.token}`);
          console.log(`    Node Token: ${config.nodeToken}`);
          
          if (config.defaultPTZSpeed) {
            console.log(`    Default Speed:`);
            if (config.defaultPTZSpeed.panTilt) {
              console.log(`      Pan/Tilt: x=${config.defaultPTZSpeed.panTilt.x}, y=${config.defaultPTZSpeed.panTilt.y}`);
            }
            if (config.defaultPTZSpeed.zoom) {
              console.log(`      Zoom: ${config.defaultPTZSpeed.zoom.x}`);
            }
          }
        });
      } else {
        console.log('  ℹ️  No configurations found');
      }
      console.log('\n');

      // 4. Test PTZ Status
      console.log('📊 PTZ Status:');
      const profileToken = cam.profiles[0]?.token;
      if (!profileToken) {
        console.log('  ❌ No profile token available');
        process.exit(0);
      }

      cam.getStatus({ profileToken }, (err, status) => {
        if (err) {
          console.log('  ❌ Cannot get status:', err.message);
        } else {
          console.log('  Current Position:');
          if (status.position?.panTilt) {
            console.log(`    Pan: ${status.position.panTilt.x}`);
            console.log(`    Tilt: ${status.position.panTilt.y}`);
          }
          if (status.position?.zoom) {
            console.log(`    Zoom: ${status.position.zoom.x}`);
          }
          console.log('  Move Status:', status.moveStatus || 'Unknown');
          console.log('  Error:', status.error || 'None');
        }
        console.log('\n');

        // 5. Try AbsoluteMove (small movement)
        console.log('🧪 Testing AbsoluteMove (small movement)...');
        cam.absoluteMove({
          profileToken,
          position: {
            x: 0.1,  // Small pan
            y: 0,    // No tilt
            zoom: 1  // No zoom change
          },
          speed: {
            x: 0.5,
            y: 0.5,
            zoom: 1
          }
        }, (err) => {
          if (err) {
            console.log('  ❌ AbsoluteMove failed:', err.message);
          } else {
            console.log('  ✅ AbsoluteMove SUCCESS! Camera should move slightly');
          }
          
          // Wait and move back
          setTimeout(() => {
            console.log('\n🔄 Moving back to center...');
            cam.absoluteMove({
              profileToken,
              position: { x: 0, y: 0, zoom: 1 },
              speed: { x: 0.5, y: 0.5, zoom: 1 }
            }, (err) => {
              if (err) {
                console.log('  ❌ Move back failed:', err.message);
              } else {
                console.log('  ✅ Moved back to center');
              }
              console.log('\n✅ Diagnostics complete!');
              process.exit(0);
            });
          }, 2000);
        });
      });
    });
  });
});
