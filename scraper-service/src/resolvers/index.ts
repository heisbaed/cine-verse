import { resolveVidnestStreams } from './vidnest';
import type { Env, MediaRequest, StreamRecord, ResolutionObserver } from '../types';
import { resolveVidzeeStreams } from './vidzee';
import { resolveVixStreams } from './vix';

export async function resolveDirectSources(
  request: MediaRequest,
  env: Env,
  proxyBase: string,
  signal: AbortSignal,
  observer: ResolutionObserver = {},
): Promise<StreamRecord[]> {
  if (env.DIRECT_RESOLVERS !== 'true') return [];
  const publish = (streams: StreamRecord[]) => { streams.forEach(stream => observer.onStream?.(stream)); return streams; };
  const results = await Promise.allSettled([
    resolveVidzeeStreams(request, env, proxyBase, signal, observer),
    resolveVixStreams(request, env, proxyBase, signal, observer).then(publish),
    resolveVidnestStreams(request, signal, observer),
  ]);
  const found = new Map<string, StreamRecord>();
  for (const stream of results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])) {
    if (!found.has(stream.url)) found.set(stream.url, stream);
  }
  return [...found.values()];
}
