import { Injectable } from '@nestjs/common';
// Triển khai NetSdkService nội bộ không còn phụ thuộc bridge native.
// Lưu state đăng nhập tạm trong bộ nhớ (mapping handle -> session info).
// PTZ sẽ giả lập (hoặc bạn thay bằng ONVIF / chuẩn riêng sau này).

type LoginResult = { ok: boolean; handle?: number; error?: string };

interface SessionInfo {
  handle: number;
  ip: string;
  port: number;
  username: string;
  loginAt: Date;
}

@Injectable()
export class NetSdkService {
  private sessions = new Map<number, SessionInfo>();
  private nextHandle = 1;

  // Danh sách tất cả session (phục vụ GET /netsdk/sessions)
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({ ...s }));
  }

  // Lấy chi tiết một session
  getSession(handle: number): SessionInfo | undefined {
    const s = this.sessions.get(handle);
    return s ? { ...s } : undefined;
  }

  async login(ip: string, port: number, username: string, _password: string): Promise<LoginResult> {
    const handle = this.nextHandle++;
    this.sessions.set(handle, { handle, ip, port, username, loginAt: new Date() });
    return { ok: true, handle };
  }

  async logout(handle: number) {
    const existed = this.sessions.delete(handle);
    return { ok: existed };
  }

  async snapshotDevice(handle: number, channel: number, filePath: string) {
    if (!this.sessions.has(handle)) return { ok: false, error: 'INVALID_HANDLE' };
    // Không còn SDK native => trả về giả lập; có thể tích hợp ONVIF snapshot sau.
    return { ok: false, error: 'SNAPSHOT_UNSUPPORTED_NO_SDK', channel, filePath };
  }

  async ptzControl(handle: number, channel: number, cmd: string, p1 = 0, p2 = 0, p3 = 0, stop = false) {
    if (!this.sessions.has(handle)) return { ok: false, error: 'INVALID_HANDLE' };
    // Giả lập kết quả PTZ. Có thể thay bằng ONVIF (ContinuousMove/RelativeMove) trong tương lai.
    return { ok: true, handle, channel, cmd, p1, p2, p3, stop };
  }
}
