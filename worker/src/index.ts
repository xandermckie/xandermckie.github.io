import { handleApi } from './app';
import type { Env } from './env';
import { handleOps } from './ops';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const ops = await handleOps(request, env);
  if (ops) return ops;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return handleApi(request, env);
  }
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
