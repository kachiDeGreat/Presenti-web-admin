import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function splitTerse(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && i + 1 < line.length) {
      current += line[i + 1];
      i++;
    } else if (line[i] === ':') {
      parts.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  parts.push(current);
  return parts;
}

function wifiScanPlugin(): Plugin {
  return {
    name: 'wifi-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan-wifi', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          // Trigger hardware rescan
          try {
            await execAsync('nmcli dev wifi rescan', { timeout: 2000 });
          } catch {
            // ignore rescan timeout
          }

          const { stdout } = await execAsync(
            'nmcli -t -f IN-USE,SSID,BSSID,SIGNAL,BARS,SECURITY,FREQ,CHAN dev wifi list',
            { timeout: 4000 }
          );

          const lines = stdout.trim().split('\n').filter(Boolean);
          const seen = new Set<string>();
          const networks = [];

          for (const line of lines) {
            const [inUse, ssid, bssid, signal, bars, security, freq, chan] = splitTerse(line);
            if (!ssid || ssid === '--') continue;
            const cleanBssid = bssid ? bssid.toLowerCase() : '';
            const key = `${ssid}-${cleanBssid}`;
            if (seen.has(key)) continue;
            seen.add(key);

            networks.push({
              inUse: inUse === '*',
              ssid,
              bssid: cleanBssid,
              signal: `${signal}%`,
              bars: bars || '',
              security: security || 'Open',
              band: freq && freq.includes('5') ? '5 GHz' : '2.4 GHz',
              freq: freq || '',
              channel: parseInt(chan || '1', 10),
            });
          }

          // Sort connected network first, then by signal
          networks.sort((a, b) => {
            if (a.inUse && !b.inUse) return -1;
            if (!a.inUse && b.inUse) return 1;
            return parseInt(b.signal, 10) - parseInt(a.signal, 10);
          });

          res.end(JSON.stringify({ success: true, networks }));
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : 'Scan error';
          res.end(JSON.stringify({ success: false, networks: [], error: errMsg }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wifiScanPlugin()],
});
