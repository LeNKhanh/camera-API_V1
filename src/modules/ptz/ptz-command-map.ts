// Central PTZ command code mapping.
// Chỉ cần sửa bảng dưới mà không đụng tới service.
// Range chuẩn hoá: dùng dải liên tục để dễ lọc / so sánh.
// Assumption (có thể khác tài liệu của bạn) – vui lòng thay nếu cần:
// 0 STOP
// 1 TILT_UP
// 2 TILT_DOWN
// 3 PAN_LEFT
// 4 PAN_RIGHT
// 5 PAN_LEFT_UP (diagonal)
// 6 PAN_RIGHT_UP
// 7 PAN_LEFT_DOWN
// 8 PAN_RIGHT_DOWN
// 9 ZOOM_IN
// 10 ZOOM_OUT
// 11 FOCUS_NEAR
// 12 FOCUS_FAR
// 13 IRIS_OPEN
// 14 IRIS_CLOSE
// 15 PRESET_SET
// 16 PRESET_DELETE
// 17 PRESET_GOTO
// (Dự phòng mở rộng)
// 18 AUTO_SCAN_START
// 19 AUTO_SCAN_STOP
// 20 PATTERN_START
// 21 PATTERN_STOP
// 22 PATTERN_RUN
// 23 TOUR_START
// 24 TOUR_STOP

// Export mapping as a plain object (not enum) to keep tree-shaking simple.
export const StandardPtzActionCodes: { [k in StandardPtzAction | string]?: number } = {
  STOP: 0,
  TILT_UP: 1,
  TILT_DOWN: 2,
  PAN_LEFT: 3,
  PAN_RIGHT: 4,
  PAN_LEFT_UP: 5,
  PAN_RIGHT_UP: 6,
  PAN_LEFT_DOWN: 7,
  PAN_RIGHT_DOWN: 8,
  ZOOM_IN: 9,
  ZOOM_OUT: 10,
  FOCUS_NEAR: 11,
  FOCUS_FAR: 12,
  IRIS_OPEN: 13,
  IRIS_CLOSE: 14,
  PRESET_SET: 15,
  PRESET_DELETE: 16,
  PRESET_GOTO: 17,
  AUTO_SCAN_START: 18,
  AUTO_SCAN_STOP: 19,
  PATTERN_START: 20,
  PATTERN_STOP: 21,
  PATTERN_RUN: 22,
  TOUR_START: 23,
  TOUR_STOP: 24,
} as const;

export type StandardPtzAction =
  | 'STOP'
  | 'TILT_UP'
  | 'TILT_DOWN'
  | 'PAN_LEFT'
  | 'PAN_RIGHT'
  | 'PAN_LEFT_UP'
  | 'PAN_RIGHT_UP'
  | 'PAN_LEFT_DOWN'
  | 'PAN_RIGHT_DOWN'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'FOCUS_NEAR'
  | 'FOCUS_FAR'
  | 'IRIS_OPEN'
  | 'IRIS_CLOSE'
  | 'PRESET_SET'
  | 'PRESET_DELETE'
  | 'PRESET_GOTO'
  | 'AUTO_SCAN_START'
  | 'AUTO_SCAN_STOP'
  | 'PATTERN_START'
  | 'PATTERN_STOP'
  | 'PATTERN_RUN'
  | 'TOUR_START'
  | 'TOUR_STOP';

// Helper: reverse lookup (nếu cần future)
export const StandardPtzCodeToAction: Record<number, StandardPtzAction> = Object.entries(StandardPtzActionCodes)
  .reduce((acc, [k, v]) => { acc[v] = k as StandardPtzAction; return acc; }, {} as Record<number, StandardPtzAction>);

// Dahua HTTP API command names (used in CGI URL)
export const DahuaPtzCommandNames: { [k in StandardPtzAction | string]?: string } = {
  STOP: 'Stop',
  TILT_UP: 'Up',
  TILT_DOWN: 'Down',
  PAN_LEFT: 'Left',
  PAN_RIGHT: 'Right',
  PAN_LEFT_UP: 'LeftUp',
  PAN_RIGHT_UP: 'RightUp',
  PAN_LEFT_DOWN: 'LeftDown',
  PAN_RIGHT_DOWN: 'RightDown',
  ZOOM_IN: 'ZoomWide',
  ZOOM_OUT: 'ZoomTele',
  FOCUS_NEAR: 'FocusNear',
  FOCUS_FAR: 'FocusFar',
  IRIS_OPEN: 'IrisLarge',
  IRIS_CLOSE: 'IrisSmall',
  PRESET_SET: 'GotoPreset',
  PRESET_DELETE: 'ClearPreset',
  PRESET_GOTO: 'GotoPreset',
  AUTO_SCAN_START: 'AutoScanStart',
  AUTO_SCAN_STOP: 'AutoScanStop',
} as const;
