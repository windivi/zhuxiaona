import * as http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { BrowserWindow, ipcMain } from 'electron';

let _transcodeServerPort = 0;
let _ffmpegSupportsNvenc = false;
type Job = {
  hash: string;
  input: string;
  tmpPath: string;
  ffmpeg: any;
  duration?: number;
  resList?: Array<{ req: http.IncomingMessage; res: http.ServerResponse }>;
  streamingMode?: boolean;
  finished?: boolean;
};
let _currentJob: Job | null = null;

function broadcastTranscodeProgress(payload: { progress: number; time?: number; duration?: number; hash?: string }) {
  try {
    BrowserWindow.getAllWindows().forEach(w => {
      try { w.webContents.send('transcode-progress', payload); } catch (e) {}
    });
  } catch (e) {}
}

function broadcastTranscodeLog(level: 'info' | 'warn' | 'error', message: string) {
  try {
    const payload = { level, message };
    BrowserWindow.getAllWindows().forEach(w => {
      try { w.webContents.send('transcode-log', payload); } catch (e) {}
    });
  } catch (e) {}
  if (level === 'error') console.error('[transcode]', message);
  else if (level === 'warn') console.warn('[transcode]', message);
  else console.log('[transcode]', message);
}

async function detectFfmpegHwSupport(): Promise<{ nvenc: boolean; hwaccels: string[] }> {
  return new Promise((resolve) => {
    try {
      const enc = spawn('ffmpeg', ['-hide_banner', '-encoders']);
      let out = '';
      enc.stdout.on('data', (c: Buffer) => out += c.toString());
      enc.stderr.on('data', () => {});
      enc.on('close', () => {
        const nvenc = /h264_nvenc|hevc_nvenc/i.test(out);
        const hw = spawn('ffmpeg', ['-hide_banner', '-hwaccels']);
        let hout = '';
        hw.stdout.on('data', (c: Buffer) => hout += c.toString());
        hw.stderr.on('data', () => {});
        hw.on('close', () => {
          const hwaccels = hout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          resolve({ nvenc, hwaccels });
        });
        hw.on('error', () => resolve({ nvenc, hwaccels: [] }));
      });
      enc.on('error', () => resolve({ nvenc: false, hwaccels: [] }));
    } catch (e) {
      resolve({ nvenc: false, hwaccels: [] });
    }
  });
}

// Start server and register IPC handlers inside this module
export async function initTranscode(): Promise<number> {
  // probe ffmpeg hw
  try {
    const info = await detectFfmpegHwSupport();
    _ffmpegSupportsNvenc = !!info.nvenc;
    broadcastTranscodeLog('info', 'ffmpeg hw support probe: ' + JSON.stringify(info));
    broadcastTranscodeLog('info', 'ffmpeg supports nvenc: ' + _ffmpegSupportsNvenc);
  } catch (e) {
    broadcastTranscodeLog('warn', 'failed to probe ffmpeg hw support: ' + String(e));
    _ffmpegSupportsNvenc = false;
  }

  // register IPC handlers
  ipcMain.handle('get-transcode-url', (event, inputUrl: string) => {
    if (!_transcodeServerPort) {
      return { success: false, message: 'transcode server not ready' };
    }
    const encoded = encodeURIComponent(inputUrl || '');
    const hash = crypto.createHash('md5').update(String(inputUrl || '')).digest('hex').slice(0, 8);
    // check for existing tmp cached files for this hash
    let cacheFile: string | null = null;
    try {
      const tmpDir = os.tmpdir();
      const files = fs.readdirSync(tmpDir);
      const matched = files.filter(f => f.startsWith(`transcode-${hash}-`) && f.endsWith('.mp4'));
      if (matched.length > 0) {
        // pick newest by timestamp in name or mtime
        const candidates = matched.map(f => {
          let ts = NaN;
          try {
            const namePart = f.slice(`transcode-${hash}-`.length, f.length - 4);
            ts = parseInt(namePart, 10);
          } catch (e) { ts = NaN; }
          if (isNaN(ts)) {
            try { ts = fs.statSync(path.join(tmpDir, f)).mtimeMs; } catch (e) { ts = 0; }
          }
          return { f, ts };
        }).sort((a, b) => b.ts - a.ts);
        if (candidates.length > 0) cacheFile = candidates[0].f;
      }
    } catch (e) { cacheFile = null; }

    // If cacheFile exists and there is no active streaming job for same hash then return a cache URL
    if (cacheFile && (!_currentJob || _currentJob.hash !== hash || (_currentJob && _currentJob.finished))) {
      const cacheParam = encodeURIComponent(cacheFile);
      return {
        success: true,
        url: `http://127.0.0.1:${_transcodeServerPort}/transcode.mp4?url=${encoded}&cache=${cacheParam}`,
        hash,
        ready: true,
        cacheFile
      };
    }

    return {
      success: true,
      url: `http://127.0.0.1:${_transcodeServerPort}/transcode.mp4?url=${encoded}`,
      hash,
      ready: false
    };
  });

  ipcMain.handle('probe-video', async (event, inputUrl: string) => {
    const res: any = { success: false };
    if (!inputUrl) { res.error = 'missing url'; return res; }
    try { const tmp = new URL(inputUrl); res.format = (tmp.pathname || '').split('.').pop() || ''; } catch (e) { res.format = ''; }
    const probeArgs = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', inputUrl];
    let codecName: string | null = null;
    try {
      const proc = spawn('ffprobe', probeArgs, { windowsHide: true });
      let out = ''; let err = '';
      const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 7000);
      proc.stdout.on('data', (c: Buffer) => out += c.toString());
      proc.stderr.on('data', (c: Buffer) => err += c.toString());
      const exitCode: number = await new Promise((resolve) => proc.on('close', resolve).on('error', () => resolve(1)));
      clearTimeout(killer);
      if (exitCode === 0 && out) { codecName = out.split(/\s+/)[0].trim().toLowerCase(); res.codec = codecName; }
      else res.probeError = err || 'ffprobe failed';
    } catch (e) { res.probeError = String(e); }
    const isMov = (res.format === 'mov');
    const isHevc = !!(codecName && /hevc|h265|x265/i.test(codecName));
    res.shouldTranscode = isMov || isHevc;
    res.success = true;
    return res;
  });

  // cancel
  ipcMain.handle('cancel-transcode', async () => {
    const jobHash = _currentJob ? _currentJob.hash : undefined;
    if (_currentJob && _currentJob.ffmpeg) {
      try { _currentJob.ffmpeg.kill('SIGKILL'); } catch (e) {}
    }
    if (_currentJob && _currentJob.tmpPath) {
      try { if (fs.existsSync(_currentJob.tmpPath)) fs.unlinkSync(_currentJob.tmpPath); } catch (e) {}
    }
    _currentJob = null;
    broadcastTranscodeLog('info', 'transcode cancelled by request');
    broadcastTranscodeProgress({ hash: jobHash || '', progress: 0, duration: 0, time: 0 });
    try { BrowserWindow.getAllWindows().forEach(w => w.webContents.send('transcode-log', { level: 'info', message: 'transcode cancelled' })); } catch (e) {}
    return { success: true };
  });

  // start HTTP server with dedupe/attach capability
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) { res.writeHead(400); res.end('Bad Request'); return; }
      const full = new URL(req.url, `http://127.0.0.1`);
      if (!full.pathname.startsWith('/transcode')) { res.writeHead(404); res.end('Not Found'); return; }
      const input = full.searchParams.get('url') || '';
      if (!input) { res.writeHead(400); res.end('missing url param'); return; }
      if (!/^https?:\/\//i.test(input)) { res.writeHead(400); res.end('only http(s) urls are allowed'); return; }

      const hash = crypto.createHash('md5').update(input).digest('hex').slice(0, 8);

      // If request asks for serving a cached file directly, and the file exists and is not the same as an active streaming job,
      // serve the file with Accept-Ranges support.
      const cacheParam = full.searchParams.get('cache');
      if (cacheParam) {
        try {
          const tmpDir = os.tmpdir();
          // basic sanitize: only allow names that match expected prefix
          if (cacheParam.startsWith(`transcode-${hash}-`) && cacheParam.endsWith('.mp4')) {
            const fpath = path.join(tmpDir, cacheParam);
            if (fs.existsSync(fpath)) {
              // If there is an active streaming job for the same hash, prefer attaching to it instead of serving file
              if (!(_currentJob && _currentJob.hash === hash && _currentJob.streamingMode && !_currentJob.finished)) {
                // serve static file with Range support
                try {
                  const stat = fs.statSync(fpath);
                  const total = stat.size;
                  const range = req.headers.range;
                  if (range) {
                    const m = /bytes=(\d+)-(\d*)/.exec(range.toString());
                    if (m) {
                      const start = parseInt(m[1], 10);
                      const end = m[2] ? parseInt(m[2], 10) : total - 1;
                      const chunkSize = (end - start) + 1;
                      const headers: any = {
                        'Content-Range': `bytes ${start}-${end}/${total}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': String(chunkSize),
                        'Content-Type': 'video/mp4'
                      };
                      res.writeHead(206, headers);
                      const stream = fs.createReadStream(fpath, { start, end });
                      stream.pipe(res);
                      stream.on('error', () => { try { res.destroy(); } catch (e) {} });
                      return;
                    }
                  }
                  // full file
                  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(total), 'Accept-Ranges': 'bytes' });
                  const fullStream = fs.createReadStream(fpath);
                  fullStream.pipe(res);
                  fullStream.on('error', () => { try { res.destroy(); } catch (e) {} });
                  return;
                } catch (e) {}
              }
            }
          }
        } catch (e) {}
      }

      // If there is an active job with same hash and streaming, attach this response to it (dedupe)
      if (_currentJob && _currentJob.hash === hash && _currentJob.streamingMode && _currentJob.ffmpeg && !_currentJob.finished) {
        broadcastTranscodeLog('info', `attaching to existing transcode job ${hash}`);
        // attach headers
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Transfer-Encoding': 'chunked', 'Accept-Ranges': 'none' });
        _currentJob.resList = _currentJob.resList || [];
        _currentJob.resList.push({ req: req, res });
        try {
          // pipe ffmpeg stdout to this res as well
          _currentJob.ffmpeg.stdout.pipe(res);
        } catch (e) {}
        // if client closes, unpipe
        req.on('close', () => { try { _currentJob && _currentJob.ffmpeg && _currentJob.ffmpeg.stdout && _currentJob.ffmpeg.stdout.unpipe && _currentJob.ffmpeg.stdout.unpipe(res); } catch (e) {} });
        return;
      }

      // Otherwise start a new job
      // cleanup old same-hash files: keep at most 5 (sliding window)
      const tmpDir = os.tmpdir();
      try {
        const allFiles = fs.readdirSync(tmpDir);
        const matched = allFiles.filter(f => f.startsWith(`transcode-${hash}-`) && f.endsWith('.mp4'));
        if (matched.length > 0) {
          // try to extract timestamp from filename `transcode-<hash>-<ts>.mp4`, fallback to mtime
          const withTs = matched.map((f) => {
            let ts = NaN;
            try {
              const namePart = f.slice(`transcode-${hash}-`.length, f.length - 4);
              ts = parseInt(namePart, 10);
            } catch (e) { ts = NaN; }
            if (isNaN(ts)) {
              try { ts = fs.statSync(path.join(tmpDir, f)).mtimeMs; } catch (e) { ts = 0; }
            }
            return { f, ts };
          }).sort((a, b) => a.ts - b.ts);
          const maxKeep = 5;
          if (withTs.length >= maxKeep) {
            // remove as many oldest files as needed so that after adding new one we still have at most maxKeep
            const numToRemove = withTs.length - (maxKeep - 1);
            for (let i = 0; i < numToRemove; i++) {
              const rem = withTs[i];
              try { fs.unlinkSync(path.join(tmpDir, rem.f)); broadcastTranscodeLog('info', 'removed old tmp file: ' + rem.f); } catch (e) {}
            }
          }
        }
      } catch (e) {}

      if (_currentJob && _currentJob.ffmpeg) {
        try { broadcastTranscodeLog('info', 'killing previous transcode job for switch'); _currentJob.ffmpeg.kill('SIGKILL'); } catch (e) {}
        try { if (_currentJob.tmpPath && fs.existsSync(_currentJob.tmpPath)) fs.unlinkSync(_currentJob.tmpPath); } catch (e) {}
        _currentJob = null;
      }

      const tmpName = `transcode-${hash}-${Date.now()}.mp4`;
      const tmpPath = path.join(tmpDir, tmpName);

      // build ffmpeg args
      let args: string[] = [];
      if (_ffmpegSupportsNvenc) {
        args = [
          '-hide_banner','-loglevel','error','-hwaccel','cuda','-hwaccel_output_format','cuda','-fflags','nobuffer','-analyzeduration','0','-probesize','32','-i',input,
          '-c:v','h264_nvenc','-preset','p1','-rc','vbr_hq','-cq','23','-b:v','0','-c:a','aac','-b:a','128k','-f','mp4','-movflags','frag_keyframe+empty_moov+default_base_moof','pipe:1'
        ];
      } else {
        args = [
          '-hide_banner','-loglevel','error','-fflags','nobuffer','-analyzeduration','0','-probesize','32','-i',input,
          '-c:v','libx264','-preset','veryfast','-tune','zerolatency','-b:v','1500k','-vf','scale=trunc(min(iw,(720*iw/ih))/2)*2:trunc(min(ih,720)/2)*2','-c:a','aac','-b:a','96k','-f','mp4','-movflags','frag_keyframe+empty_moov+default_base_moof','pipe:1'
        ];
      }

      broadcastTranscodeLog('info', 'starting ffmpeg (streaming to client and saving to file): ' + tmpPath + ' args:' + args.join(' '));

      // probe duration
      let durationSec: number | undefined = undefined;
      try {
        const p = spawn('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', input], { windowsHide: true });
        let pout = '';
        const kt = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} }, 7000);
        p.stdout.on('data', (c: Buffer) => pout += c.toString());
        const code: number = await new Promise((resolve) => p.on('close', resolve).on('error', () => resolve(1)));
        clearTimeout(kt);
        if (code === 0 && pout) {
          const v = parseFloat(pout.trim()); if (!isNaN(v) && v > 0) durationSec = v;
        }
      } catch (e) {}

      // spawn ffmpeg
      const ffmpeg = spawn('ffmpeg', args, { windowsHide: true });
      _currentJob = { hash, input, tmpPath, ffmpeg, duration: durationSec, resList: [], streamingMode: false, finished: false };
      broadcastTranscodeProgress({ hash, progress: 0, duration: durationSec });

      // stderr progress handler
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        const txt = chunk.toString();
        try { broadcastTranscodeLog('info', 'ffmpeg: ' + txt); } catch (e) {}
        try {
          const m = /time=(\d{2}:\d{2}:\d{2}\.\d{2})/.exec(txt);
          if (m) {
            const hhmmss = m[1]; const parts = hhmmss.split(':');
            const secs = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
            let progress = 0; if (durationSec && durationSec > 0) progress = Math.min(1, secs / durationSec);
            broadcastTranscodeProgress({ hash, progress, time: secs, duration: durationSec });
            if (_currentJob) _currentJob.duration = durationSec;
          }
        } catch (e) {}
      });

      // stream stdout to file and to initial response
      try {
        const outStream = ffmpeg.stdout;
        const fileStream = fs.createWriteStream(tmpPath, { flags: 'w' });
        outStream.pipe(fileStream);

        // stream to initial response
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Transfer-Encoding': 'chunked', 'Accept-Ranges': 'none' });
        outStream.pipe(res);
        _currentJob.streamingMode = true;
        _currentJob.resList = [{ req, res }];

        // cleanup per-client
        req.on('close', () => {
          try { outStream.unpipe && outStream.unpipe(res); } catch (e) {}
        });
      } catch (e) {
        try { if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGKILL'); } catch (ee) {}
        res.writeHead(500); res.end('stream error: ' + String(e));
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (ee) {}
        return;
      }

      let ffErr: any = null;
      ffmpeg.on('error', (err: any) => { ffErr = err; });

      let clientAborted = false;
      req.on('close', () => {
        clientAborted = true;
        try { if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGKILL'); } catch (e) {}
      });

      // when ffmpeg completes
      ffmpeg.on('close', (code: number) => {
        try { broadcastTranscodeProgress({ hash, progress: 1, time: durationSec, duration: durationSec }); } catch (e) {}
        _currentJob && (_currentJob.finished = true);
        // leave tmp file for later range requests
        try {
          if (_currentJob && _currentJob.resList) {
            for (const rinfo of _currentJob.resList) {
              try { ffmpeg.stdout.unpipe && ffmpeg.stdout.unpipe(rinfo.res); } catch (e) {}
            }
          }
        } catch (e) {}
      });

    } catch (err) {
      res.writeHead(500);
      res.end('server error');
    }
  });

  server.on('error', (err) => { broadcastTranscodeLog('error', 'transcode server error: ' + String(err)); });
  await new Promise<number>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      // @ts-ignore
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        _transcodeServerPort = addr.port;
        resolve(_transcodeServerPort);
      } else reject(new Error('failed to get server port'));
    });
  });

  return _transcodeServerPort;
}

export function getTranscodePort() { return _transcodeServerPort; }
