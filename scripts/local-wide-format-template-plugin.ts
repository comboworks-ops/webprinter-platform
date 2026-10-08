import type { Plugin } from 'vite';
export function localWideFormatTemplates(): Plugin {
  return { name: 'local-wide-format-templates', apply: 'serve', configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if ((request.url || '').split('?')[0] !== '/api/wide-format-template') return next();
      try {
        const { default: handler } = await server.ssrLoadModule('/api/wide-format-template.ts');
        const result: Response = await handler(new Request(`http://local${request.url}`, { method: request.method }));
        response.statusCode = result.status;
        result.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch { response.statusCode = 500; response.end('Skabelonen kunne ikke genereres.'); }
    });
  } };
}
