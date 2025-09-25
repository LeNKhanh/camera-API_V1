declare module 'dotenv' {
  export function config(options?: any): { parsed?: Record<string, string>; error?: Error };
}

declare module 'ffmpeg-static' {
  const pathToFfmpeg: string | null;
  export default pathToFfmpeg;
}
