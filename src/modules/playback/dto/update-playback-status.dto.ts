// ============================================================================
// UPDATE PLAYBACK STATUS DTO
// ============================================================================
// Chỉ cho phép user thay đổi 3 trạng thái điều khiển thủ công.
// Các trạng thái khác (PENDING, COMPLETED, FAILED) hệ thống tự set.
// ============================================================================
import { IsEnum } from 'class-validator';

export enum PlaybackManualStatus {
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export class UpdatePlaybackStatusDto {
  @IsEnum(PlaybackManualStatus, {
    message: 'status must be one of the following values: PLAYING, PAUSED, STOPPED',
  })
  status: PlaybackManualStatus;
}
