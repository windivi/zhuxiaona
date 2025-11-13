import * as http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';

export function startTranscodeServer(hwAccelType: string | null): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) { res.writeHead(400); res.end('Bad Request'); return; }
        const full = new URL(req.url, `http://127.0.0.1`);
        if (!full.pathname.startsWith('/transcode')) { res.writeHead(404); res.end('Not Found'); return; }

        const input = full.searchParams.get('url') || '';
        if (!input) { res.writeHead(400); res.end('missing url param'); return; }
        if (!/^https?:\/\//i.test(input)) { res.writeHead(400); res.end('only http(s) urls are allowed'); return; }

        const args: string[] = ['-hide_banner', '-loglevel', 'error'];
        if (hwAccelType) { args.push('-hwaccel', hwAccelType); args.push('-hwaccel_output_format', hwAccelType); }

        args.push(
          '-fflags', '+nobuffer+fastseek',
          '-analyzeduration', '1000000',
          '-probesize', '5000000',
          '-i', input,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-profile:v', 'baseline',
          '-level', '3.0',
          '-b:v', '1200k',
          '-maxrate', '1500k',
          '-bufsize', '3000k',
          '-g', '30',
          '-keyint_min', '30',
          '-vf', 'scale=trunc(min(iw\\,1280)/2)*2:trunc(min(ih\\,720)/2)*2',
          '-r', '25',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
          'pipe:1'
        );

        let ffmpeg: any = null;
        try { ffmpeg = spawn('ffmpeg', args, { windowsHide: true }); }
        catch (e) { res.writeHead(500); res.end('failed to start ffmpeg: ' + String(e)); return; }

        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-cache', 'Connection': 'close' });
        ffmpeg.stdout.pipe(res);

        let errorLog = '';
        ffmpeg.stderr.on('data', (chunk: Buffer) => { errorLog += chunk.toString(); });

        ffmpeg.on('error', (err: any) => { console.error('[transcode] ffmpeg error:', err); try { res.end(); } catch (e) { } });

        req.on('close', () => { try { if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGKILL'); } catch (e) { } });

        ffmpeg.on('close', (code: number, signal: string) => { if (code !== 0 && code !== null) { console.error(`[transcode] ffmpeg exited with code ${code}`); console.error('[transcode] stderr:', errorLog); } try { res.end(); } catch (e) { } });

      } catch (err) { res.writeHead(500); res.end('server error'); }
    });

    server.on('error', (err) => reject(err));
    server.listen(0, '127.0.0.1', () => {
      // @ts-ignore
      const addr = server.address();
      if (addr && typeof addr === 'object') { resolve(addr.port); } else { reject(new Error('failed to get server port')); }
    });
  });
}
