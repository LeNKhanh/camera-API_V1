# NetSDK Bridge Contract

The NestJS service supports two bridge modes:
1) CLI bridge: execute a native EXE with one JSON argument and read JSON from stdout.
2) HTTP bridge: POST JSON to an HTTP endpoint (NETSDK_BRIDGE_URL) and read JSON response. Recommended for long-lived sessions.

CLI input (argv[1]):
{
  "cmd": "login" | "logout" | "ptz" | "snapshot" | "realplay_start" | "realplay_stop",
  "args": { ... }
}

CLI output: a single-line JSON on stdout. Use non-zero exit code on fatal errors and write details to stderr.

HTTP input:
- URL: NETSDK_BRIDGE_URL, method: POST, content-type: application/json
- Body: same JSON payload as CLI input
HTTP output:
- 200 OK with JSON body same shape as CLI output; non-200 indicates error.

Commands
- login { ip: string, port: number, username: string, password: string } → { ok: true, handle: number } | { ok: false, error: string }
- logout { handle: number } → { ok: true }
- ptz { handle: number, channel: number, cmd: string, p1?: number, p2?: number, p3?: number, stop?: boolean } → { ok: true }
- snapshot { handle: number, channel: number, filePath: string } → { ok: true, filePath: string }
- realplay_start { handle: number, channel: number } → { ok: true, realHandle: number }
- realplay_stop { realHandle: number } → { ok: true }

Return numeric handles from the underlying SDK.

Notes
- Initialize and cleanup SDK per process: CLIENT_Init on program start, CLIENT_Cleanup before exit.
- Maintain a handle table (login handles, realplay handles) so commands can reference them.
- Link correct architecture (x64 recommended). Place DLLs next to the EXE or ensure PATH.
 - For HTTP bridge, run a long-lived process (Windows Service) with a handle table in memory so handles persist across API calls.
