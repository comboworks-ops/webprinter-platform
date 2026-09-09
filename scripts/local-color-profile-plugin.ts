import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

// ECI permits use and embedding, but standalone redistribution needs permission.
// Developer-provisioned files stay under ignored tmp/, outside production assets.
const LOCAL_PROFILES: Record<string, string> = {
  '/icc/PSOcoated_v3.icc': 'PSOcoated_v3.icc',
  '/icc/PSOuncoated_v3_FOGRA52.icc': 'PSOuncoated_v3_FOGRA52.icc',
};

export function localColorProfileAssets(): Plugin {
  return {
    name: 'local-color-profile-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const filename = LOCAL_PROFILES[(request.url || '').split('?')[0]];
        if (!filename || !['GET', 'HEAD'].includes(request.method || '')) return next();
        try {
          const bytes = await readFile(path.join(server.config.root, 'tmp/local-color-profiles', filename));
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/vnd.iccprofile');
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('Content-Length', bytes.length);
          response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end('Install the official profile for this shop, or run the local profile preparation script.');
        }
      });
    },
  };
}
