import { spawn } from 'child_process';

export async function detectHardwareAccel(): Promise<string | null> {
  if (process.platform !== 'win32') return null;

  return new Promise((resolve) => {
    const test = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-hwaccels'], { windowsHide: true });

    let output = '';
    test.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });

    test.on('close', () => {
      if (output.includes('dxva2')) { console.log('[HW Accel] DXVA2 available'); resolve('dxva2'); }
      else if (output.includes('d3d11va')) { console.log('[HW Accel] D3D11VA available'); resolve('d3d11va'); }
      else { console.log('[HW Accel] No hardware acceleration detected'); resolve(null); }
    });

    test.on('error', () => resolve(null));

    setTimeout(() => { try { test.kill(); } catch (e) { } resolve(null); }, 3000);
  });
}
