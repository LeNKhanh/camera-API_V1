'use client';

import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { SSO_TOKEN, API_BASE_URL, TEST_CAMERA_ID } from '../config';

interface StreamUrls {
  rtsp: string;
  hls: string;
  hlsWebPlayer: string;
  webrtc: string;
}

interface CameraResponse {
  cameraId: string;
  cameraName: string;
  pathId: string;
  protocols: StreamUrls;
  instructions: any;
  security: any;
  configuration: any;
}

export default function Home() {
  const [cameraId, setCameraId] = useState(TEST_CAMERA_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<CameraResponse | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Test API endpoints
  const testEndpoint = async (endpoint: string, label: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[${label}] Testing: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${SSO_TOKEN}`,
        },
      });

      console.log(`[${label}] Status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log(`[${label}] Response:`, data);
      
      setStreamData(data);
      
      if (data.protocols?.hls) {
        setHlsUrl(data.protocols.hls);
      }
      
      return data;
    } catch (err: any) {
      console.error(`[${label}] Error:`, err);
      setError(`[${label}] ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load HLS stream
  const loadHlsStream = (url: string) => {
    if (!videoRef.current) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✓ HLS manifest loaded successfully');
        videoRef.current?.play();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('✗ HLS Error:', data);
        if (data.fatal) {
          setError(`HLS Error: ${data.type} - ${data.details}`);
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = url;
      videoRef.current.play();
    } else {
      setError('HLS is not supported in this browser');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🎥 Camera API Test Frontend</h1>
      <p style={{ color: '#666' }}>Test streaming endpoints với SSO authentication</p>
      
      {/* Environment Indicator */}
      <div style={{ 
        padding: '10px 15px', 
        backgroundColor: API_BASE_URL.includes('localhost') ? '#fff3cd' : '#d1ecf1',
        borderLeft: `4px solid ${API_BASE_URL.includes('localhost') ? '#ffc107' : '#0dcaf0'}`,
        borderRadius: '4px',
        marginTop: '15px',
        marginBottom: '15px'
      }}>
        <strong>🌐 Environment:</strong> {API_BASE_URL.includes('localhost') ? 'LOCAL' : 'PRODUCTION'} <br />
        <small style={{ color: '#666' }}>API: <code>{API_BASE_URL}</code></small>
      </div>

      <hr style={{ margin: '20px 0' }} />

      {/* Camera ID Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Camera ID:
        </label>
        <input
          type="text"
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
          placeholder="Enter camera ID"
        />
      </div>

      {/* Test Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => testEndpoint(
            `${API_BASE_URL}/streams/${cameraId}/proxy`,
            'Test 1: /proxy'
          )}
          disabled={loading}
          style={{
            padding: '12px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          Test /proxy (no param)
        </button>

        <button
          onClick={() => testEndpoint(
            `${API_BASE_URL}/streams/${cameraId}/proxy?protocol=HLS`,
            'Test 2: /proxy?protocol=HLS'
          )}
          disabled={loading}
          style={{
            padding: '12px 20px',
            backgroundColor: '#7928ca',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          Test /proxy?protocol=HLS
        </button>

        <button
          onClick={() => testEndpoint(
            `${API_BASE_URL}/streams/${cameraId}/url?protocol=HLS`,
            'Test 3: /url?protocol=HLS'
          )}
          disabled={loading}
          style={{
            padding: '12px 20px',
            backgroundColor: '#ff0080',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          Test /url?protocol=HLS
        </button>

        <button
          onClick={() => testEndpoint(
            `${API_BASE_URL}/cameras`,
            'Test 4: GET /cameras'
          )}
          disabled={loading}
          style={{
            padding: '12px 20px',
            backgroundColor: '#00aa55',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          List All Cameras
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#1976d2' }}>⏳ Loading...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#c62828', fontWeight: 'bold' }}>❌ Error:</p>
          <pre style={{ margin: '10px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {error}
          </pre>
        </div>
      )}

      {/* Stream Data Display */}
      {streamData && (
        <div style={{ marginBottom: '20px' }}>
          <h2>📊 API Response:</h2>
          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '6px', overflow: 'auto' }}>
            <pre style={{ margin: 0, fontSize: '12px' }}>
              {JSON.stringify(streamData, null, 2)}
            </pre>
          </div>

          {streamData.protocols?.hls && (
            <div style={{ marginTop: '15px' }}>
              <button
                onClick={() => loadHlsStream(streamData.protocols.hls)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ▶️ Load HLS Stream
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video Player */}
      {hlsUrl && (
        <div style={{ marginTop: '20px' }}>
          <h2>📺 HLS Video Player:</h2>
          <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              controls
              style={{ width: '100%', maxWidth: '800px', display: 'block' }}
            />
          </div>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Stream URL: <code>{hlsUrl}</code>
          </p>
        </div>
      )}

      {/* Instructions */}
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '6px' }}>
        <h3 style={{ marginTop: 0 }}>📝 Hướng Dẫn:</h3>
        <ol style={{ lineHeight: '1.8' }}>
          <li><strong>Test các endpoint</strong> - Click vào các button để test API</li>
          <li><strong>Kiểm tra response</strong> - Xem status code và data trả về</li>
          <li><strong>Load stream</strong> - Nếu API trả về HLS URL, click "Load HLS Stream"</li>
          <li><strong>Phát video</strong> - Video player sẽ tự động phát stream</li>
        </ol>
        
        <h4>⚙️ Configuration:</h4>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>API Base URL:</strong> <code>{API_BASE_URL}</code></li>
          <li><strong>Test Camera ID:</strong> <code>{TEST_CAMERA_ID}</code></li>
          <li><strong>Token:</strong> <code style={{ fontSize: '11px' }}>Valid until Nov 9, 2025</code></li>
        </ul>

        <h4>🔍 Check Console (F12):</h4>
        <p style={{ margin: 0 }}>Mở Developer Console để xem detailed logs của mỗi API call</p>
      </div>
    </div>
  );
}
