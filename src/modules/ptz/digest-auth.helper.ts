/**
 * Digest Authentication Helper for Dahua Camera API
 * Compatible with CommonJS (no ESM issues)
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface DigestAuthChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

export class DigestAuthClient {
  private username: string;
  private password: string;
  private axiosInstance: AxiosInstance;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.axiosInstance = axios.create({
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  /**
   * Parse WWW-Authenticate header to extract digest challenge
   */
  private parseDigestChallenge(header: string): DigestAuthChallenge | null {
    if (!header || !header.toLowerCase().startsWith('digest ')) {
      return null;
    }

    const parts: any = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
    let match;

    while ((match = regex.exec(header)) !== null) {
      const key = match[1];
      const value = match[2] || match[3];
      parts[key] = value;
    }

    return {
      realm: parts.realm || '',
      nonce: parts.nonce || '',
      qop: parts.qop,
      opaque: parts.opaque,
      algorithm: parts.algorithm || 'MD5',
    };
  }

  /**
   * Generate MD5 hash
   */
  private md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Generate digest authorization header
   */
  private generateDigestHeader(
    method: string,
    uri: string,
    challenge: DigestAuthChallenge,
  ): string {
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    
    // HA1 = MD5(username:realm:password)
    const ha1 = this.md5(`${this.username}:${challenge.realm}:${this.password}`);
    
    // HA2 = MD5(method:uri)
    const ha2 = this.md5(`${method}:${uri}`);
    
    // response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
    let response: string;
    if (challenge.qop) {
      response = this.md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`);
    } else {
      response = this.md5(`${ha1}:${challenge.nonce}:${ha2}`);
    }

    // Build Authorization header
    let authHeader = `Digest username="${this.username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;
    
    if (challenge.qop) {
      authHeader += `, qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}"`;
    }
    
    if (challenge.opaque) {
      authHeader += `, opaque="${challenge.opaque}"`;
    }
    
    if (challenge.algorithm) {
      authHeader += `, algorithm=${challenge.algorithm}`;
    }

    return authHeader;
  }

  /**
   * Fetch with Digest Authentication (similar to digest-fetch API)
   */
  async fetch(url: string, options: { method?: string } = {}): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    text: () => Promise<string>;
  }> {
    const method = (options.method || 'GET').toUpperCase();
    const urlObj = new URL(url);
    const uri = urlObj.pathname + urlObj.search;

    try {
      // Step 1: Initial request to get 401 challenge
      const initialResponse = await this.axiosInstance.request({
        url,
        method,
      });

      // If not 401, return response directly (no auth needed or already authed)
      if (initialResponse.status !== 401) {
        return {
          ok: initialResponse.status >= 200 && initialResponse.status < 300,
          status: initialResponse.status,
          statusText: initialResponse.statusText,
          text: async () => initialResponse.data,
        };
      }

      // Step 2: Parse WWW-Authenticate header
      const wwwAuth = initialResponse.headers['www-authenticate'];
      if (!wwwAuth) {
        throw new Error('No WWW-Authenticate header in 401 response');
      }

      const challenge = this.parseDigestChallenge(wwwAuth);
      if (!challenge) {
        throw new Error('Failed to parse Digest challenge');
      }

      // Step 3: Generate Authorization header and retry
      const authHeader = this.generateDigestHeader(method, uri, challenge);
      
      const authenticatedResponse = await this.axiosInstance.request({
        url,
        method,
        headers: {
          Authorization: authHeader,
        },
      });

      return {
        ok: authenticatedResponse.status >= 200 && authenticatedResponse.status < 300,
        status: authenticatedResponse.status,
        statusText: authenticatedResponse.statusText,
        text: async () => authenticatedResponse.data,
      };
    } catch (error) {
      throw new Error(`Digest auth request failed: ${error.message}`);
    }
  }
}
