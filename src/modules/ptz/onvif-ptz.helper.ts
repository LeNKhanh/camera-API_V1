import { Cam } from 'onvif';
import { Logger } from '@nestjs/common';

/**
 * ONVIF PTZ Helper
 * Wrapper xung quanh thư viện onvif để điều khiển PTZ camera thực tế
 */
export class OnvifPtzHelper {
  private static readonly logger = new Logger(OnvifPtzHelper.name);
  private static cameraCache = new Map<string, Cam>();

  /**
   * Kết nối tới camera ONVIF
   */
  static async connect(
    ipAddress: string,
    port: number,
    username: string,
    password: string,
    cacheKey: string
  ): Promise<Cam> {
    // Kiểm tra cache
    if (this.cameraCache.has(cacheKey)) {
      const cachedCam = this.cameraCache.get(cacheKey)!;
      this.logger.debug(`[ONVIF] Using cached connection for ${cacheKey}`);
      return cachedCam;
    }

    this.logger.log(`[ONVIF] Connecting to ${ipAddress}:${port}...`);
    this.logger.debug(`[ONVIF] Username: ${username}`);

    return new Promise((resolve, reject) => {
      const cam = new Cam(
        {
          hostname: ipAddress,
          username: username,
          password: password,
          port: port,
          timeout: 15000,
          preserveAddress: true, // Dahua cần option này
          autoconnect: true,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF] Connection failed: ${err.message}`);
            this.logger.warn(`[ONVIF] Troubleshooting tips:`);
            this.logger.warn(`  1. Check username/password: ${username}/*****`);
            this.logger.warn(`  2. Verify ONVIF is enabled on camera web interface`);
            this.logger.warn(`  3. Try different ports: 80, 8000, 8899`);
            this.logger.warn(`  4. Check if Authentication is set to digest/basic`);
            return reject(err);
          }

          this.logger.log(`[ONVIF] Connected successfully to ${ipAddress}`);
          this.logger.debug(`[ONVIF] Device model: ${cam.deviceInformation?.model || 'unknown'}`);
          
          // Get default profile (REQUIRED for PTZ commands)
          if (cam.profiles && cam.profiles.length > 0) {
            // Find profile with PTZ configuration
            const ptzProfile = cam.profiles.find(p => p.PTZConfiguration) || cam.profiles[0];
            cam.defaultProfile = ptzProfile;
            this.logger.debug(`[ONVIF] Using profile: ${ptzProfile.name || ptzProfile.token}`);
            
            if (ptzProfile.PTZConfiguration) {
              this.logger.debug(`[ONVIF] PTZ Node Token: ${ptzProfile.PTZConfiguration.nodeToken}`);
            } else {
              this.logger.warn(`[ONVIF] Profile has no PTZ configuration!`);
            }
          } else {
            this.logger.warn(`[ONVIF] No profiles found on camera`);
          }
          
          // Cache connection
          this.cameraCache.set(cacheKey, cam);
          
          resolve(cam);
        }
      );
    });
  }

  /**
   * Get PTZ capabilities
   */
  static async getCapabilities(cam: Cam, cacheKey: string): Promise<any> {
    const capabilitiesCache = new Map<string, any>();
    
    if (capabilitiesCache.has(cacheKey)) {
      return capabilitiesCache.get(cacheKey);
    }

    return new Promise((resolve, reject) => {
      if (!cam.getNodes) {
        this.logger.warn(`[ONVIF] Camera does not support getNodes, assuming basic PTZ`);
        const basicCaps = {
          supportsContinuousMove: true,
          supportsRelativeMove: true,
          supportsAbsoluteMove: false,
          nodes: [],
        };
        capabilitiesCache.set(cacheKey, basicCaps);
        return resolve(basicCaps);
      }

      cam.getNodes((err, nodes) => {
        if (err) {
          this.logger.warn(`[ONVIF] Failed to get nodes (${err.message}), assuming basic PTZ`);
          const basicCaps = {
            supportsContinuousMove: true,
            supportsRelativeMove: true,
            supportsAbsoluteMove: false,
            nodes: [],
          };
          capabilitiesCache.set(cacheKey, basicCaps);
          return resolve(basicCaps);
        }

        const caps = {
          supportsContinuousMove: false,
          supportsRelativeMove: false,
          supportsAbsoluteMove: false,
          nodes: nodes,
        };

        // Check if camera supports different move types
        if (nodes && nodes.length > 0) {
          const node = nodes[0];
          caps.supportsContinuousMove = !!node.supportedPTZSpaces?.continuousPanTiltVelocitySpace;
          caps.supportsRelativeMove = !!node.supportedPTZSpaces?.relativePanTiltTranslationSpace;
          caps.supportsAbsoluteMove = !!node.supportedPTZSpaces?.absolutePanTiltPositionSpace;
        }

        this.logger.log(`[ONVIF] PTZ Capabilities:`);
        this.logger.log(`  - ContinuousMove: ${caps.supportsContinuousMove}`);
        this.logger.log(`  - RelativeMove: ${caps.supportsRelativeMove}`);
        this.logger.log(`  - AbsoluteMove: ${caps.supportsAbsoluteMove}`);

        capabilitiesCache.set(cacheKey, caps);
        resolve(caps);
      });
    });
  }

  /**
   * Di chuyển PTZ với RelativeMove (fallback cho camera không support ContinuousMove)
   */
  static async relativeMove(
    cam: Cam,
    panDistance: number,
    tiltDistance: number,
    zoomDistance: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const clamp = (val: number) => Math.max(-1, Math.min(1, val));
      const x = clamp(panDistance);
      const y = clamp(tiltDistance);
      const z = clamp(zoomDistance);

      this.logger.debug(`[ONVIF PTZ] RelativeMove: x=${x}, y=${y}, z=${z}`);

      // Get profile token
      const profileToken = cam.defaultProfile?.token || cam.activeSource?.profileToken;
      if (!profileToken) {
        this.logger.error(`[ONVIF PTZ] No profile token found!`);
        return reject(new Error('No profile token available for PTZ'));
      }

      this.logger.debug(`[ONVIF PTZ] Using profile token: ${profileToken}`);

      cam.relativeMove(
        {
          x: x,
          y: y,
          zoom: z,
          profileToken: profileToken,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] RelativeMove error: ${err.message}`);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Di chuyển PTZ với continuous move
   * @param cam ONVIF camera instance
   * @param panSpeed -1 to 1 (negative = left, positive = right)
   * @param tiltSpeed -1 to 1 (negative = down, positive = up)
   * @param zoomSpeed -1 to 1 (negative = out, positive = in)
   */
  static async continuousMove(
    cam: Cam,
    panSpeed: number,
    tiltSpeed: number,
    zoomSpeed: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Normalize speeds to -1..1 range
      const clamp = (val: number) => Math.max(-1, Math.min(1, val));
      const x = clamp(panSpeed);
      const y = clamp(tiltSpeed);
      const z = clamp(zoomSpeed);

      this.logger.debug(`[ONVIF PTZ] ContinuousMove: x=${x}, y=${y}, z=${z}`);

      // Get profile token
      const profileToken = cam.defaultProfile?.token || cam.activeSource?.profileToken;
      if (!profileToken) {
        this.logger.error(`[ONVIF PTZ] No profile token found!`);
        return reject(new Error('No profile token available for PTZ'));
      }

      this.logger.debug(`[ONVIF PTZ] Using profile token: ${profileToken}`);

      cam.continuousMove(
        {
          x: x,
          y: y,
          zoom: z,
          profileToken: profileToken,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] ContinuousMove error: ${err.message}`);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Smart move - tự động chọn method phù hợp
   */
  static async smartMove(
    cam: Cam,
    cacheKey: string,
    panSpeed: number,
    tiltSpeed: number,
    zoomSpeed: number
  ): Promise<void> {
    try {
      // Try ContinuousMove first
      try {
        await this.continuousMove(cam, panSpeed, tiltSpeed, zoomSpeed);
        this.logger.debug(`[ONVIF] Used ContinuousMove successfully`);
        return;
      } catch (contErr) {
        this.logger.warn(`[ONVIF] ContinuousMove failed: ${contErr.message}, trying RelativeMove...`);
        
        // Fallback to RelativeMove with smaller increments
        const panDist = panSpeed * 0.05; // Smaller steps for relative
        const tiltDist = tiltSpeed * 0.05;
        const zoomDist = zoomSpeed * 0.05;
        
        await this.relativeMove(cam, panDist, tiltDist, zoomDist);
        this.logger.debug(`[ONVIF] Used RelativeMove successfully`);
        return;
      }
    } catch (error) {
      this.logger.error(`[ONVIF] SmartMove failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Dừng chuyển động PTZ
   */
  static async stop(cam: Cam): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] Stop`);

      // Get profile token
      const profileToken = cam.defaultProfile?.token || cam.activeSource?.profileToken;
      if (!profileToken) {
        this.logger.warn(`[ONVIF PTZ] No profile token for stop, skipping`);
        return resolve(); // Don't fail, just skip
      }

      cam.stop(
        {
          panTilt: true,
          zoom: true,
          profileToken: profileToken,
        },
        (err) => {
          if (err) {
            // Some cameras don't need explicit stop for RelativeMove - just warn
            this.logger.warn(`[ONVIF PTZ] Stop warning: ${err.message}`);
            return resolve(); // Don't reject, camera might be already stopped
          }
          resolve();
        }
      );
    });
  }

  /**
   * Di chuyển tới absolute position
   */
  static async absoluteMove(
    cam: Cam,
    x: number,
    y: number,
    zoom: number,
    speed?: { x: number; y: number; zoom: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] AbsoluteMove: x=${x}, y=${y}, zoom=${zoom}`);

      cam.absoluteMove(
        {
          x: x,
          y: y,
          zoom: zoom,
          speed: speed,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] AbsoluteMove error: ${err.message}`);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Di chuyển tới preset
   */
  static async gotoPreset(cam: Cam, presetToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] GotoPreset: ${presetToken}`);

      cam.gotoPreset(
        {
          preset: presetToken,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] GotoPreset error: ${err.message}`);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Lưu preset
   */
  static async setPreset(
    cam: Cam,
    presetName?: string,
    presetToken?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] SetPreset: ${presetName || presetToken}`);

      cam.setPreset(
        {
          presetName: presetName,
          presetToken: presetToken,
        },
        (err, result) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] SetPreset error: ${err.message}`);
            return reject(err);
          }
          resolve(result);
        }
      );
    });
  }

  /**
   * Xóa preset
   */
  static async removePreset(cam: Cam, presetToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] RemovePreset: ${presetToken}`);

      cam.removePreset(
        {
          presetToken: presetToken,
        },
        (err) => {
          if (err) {
            this.logger.error(`[ONVIF PTZ] RemovePreset error: ${err.message}`);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Get danh sách presets
   */
  static async getPresets(cam: Cam): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`[ONVIF PTZ] GetPresets`);

      cam.getPresets((err, presets) => {
        if (err) {
          this.logger.error(`[ONVIF PTZ] GetPresets error: ${err.message}`);
          return reject(err);
        }
        resolve(presets || []);
      });
    });
  }

  /**
   * Clear cache (dùng khi update credentials)
   */
  static clearCache(cacheKey?: string) {
    if (cacheKey) {
      this.cameraCache.delete(cacheKey);
      this.logger.debug(`[ONVIF] Cleared cache for ${cacheKey}`);
    } else {
      this.cameraCache.clear();
      this.logger.debug(`[ONVIF] Cleared all cache`);
    }
  }

  /**
   * Get camera info
   */
  static async getDeviceInformation(cam: Cam): Promise<any> {
    return new Promise((resolve, reject) => {
      cam.getDeviceInformation((err, info) => {
        if (err) {
          this.logger.error(`[ONVIF] GetDeviceInformation error: ${err.message}`);
          return reject(err);
        }
        resolve(info);
      });
    });
  }
}
