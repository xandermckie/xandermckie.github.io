import type { Env } from '../env';

export async function camouflage(request: Request, env: Env): Promise<Response> {
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }
  return new Response('Not found', { status: 404 });
}
