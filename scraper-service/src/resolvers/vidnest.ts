import { readCaptions } from './captions';
// Adapted from the mobile Vidnest TMDB transport; provider payload encryption is transport only.
import type { MediaRequest, StreamRecord, ResolutionObserver } from '../types';
const SECRET = "K3p8vQ2mX9rL5wZ0fN7bG1sH4tJ6dC9_y8S3wM1nQ5pL2";
// Start every title with the current original-audio catalog, then search all remaining families.
const BACKENDS = ['ophim','yflix','rogflix','rpmvid','vidzee','nextgencloudfabric','onehd','klikxxi','flixhq','allmovies','vidlink','hollymoviehd'];
const decode64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
async function decode(json: any): Promise<any> {
  if (json.v === 2 && json.d && json.n) {
    const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${json.n}|${SECRET}`)), 'AES-GCM', false, ['decrypt']);
    const data = decode64(json.d);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name:'AES-GCM', iv:data.slice(0,12) }, key, data.slice(12))));
  }
  if (json.encrypted && json.data) return JSON.parse(new TextDecoder().decode(decode64(json.data)));
  return json;
}
function streamsFrom(data: any, backend: string): StreamRecord[] {
  const found: StreamRecord[] = [];
  const visit = (node: any, inherited: Record<string,string> = {}, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { node.forEach((item) => visit(item, inherited, depth + 1)); return; }
    if (typeof node === 'string') node = { url: node };
    if (typeof node !== 'object') return;
    const headers = { ...inherited, ...(node.headers && typeof node.headers === 'object' ? node.headers : {}) };
    const url = node.url || node.file;
    if (typeof url === 'string' && /^https:\/\//.test(url) && (/\.(m3u8|mp4)(?:$|[?#])/i.test(url) || node.hls)) {
      const local = readCaptions(node, url);
      const subtitles = local.length ? local : readCaptions(data, url);
      found.push({url,headers,subtitles,source:backend,name:'Cineverse',id:`vidnest-${backend}-${found.length}`,quality:String(node.quality || node.resolution || 'Auto'),expiresAt:Date.now()+60*60*1000,contentType:node.hls || url.includes('.m3u8') ? 'hls' : 'progressive'});
    }
    for(const field of ['streams','sources','all_urls','data']) if(node[field]) visit(node[field],headers,depth+1);
  };
  visit(data);
  return found.filter((item,index,all)=>all.findIndex(other=>other.url===item.url)===index);
}
export async function resolveVidnestStreams(request: MediaRequest, signal: AbortSignal, observer: ResolutionObserver = {}): Promise<StreamRecord[]> {
  const path = request.kind === 'movie' ? `movie/${request.tmdbId}` : `tv/${request.tmdbId}/${request.season}/${request.episode}`;
  const results: StreamRecord[] = []; let next = 0;
  await Promise.all(Array.from({length:6},async()=>{
    while(next<BACKENDS.length && !signal.aborted) {
      const backend=BACKENDS[next++]; const controller=new AbortController();
      const abort=()=>controller.abort(); signal.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,10000);
      let outcome: 'ok' | 'empty' | 'unavailable' = 'unavailable';
      try {
        const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const response=await fetch(`https://new.vidnest.fun/${backend}/${path}?_n=${nonce}`,{signal:controller.signal,headers:{Origin:'https://vidnest.fun',Referer:'https://vidnest.fun/',Accept:'application/json','User-Agent':'Mozilla/5.0'}});
        if(response.ok) {
          const streams = streamsFrom(await decode(await response.json()),backend);
          outcome = streams.length ? 'ok' : 'empty';
          results.push(...streams);
          streams.forEach(stream => observer.onStream?.(stream));
        }
      } catch { /* One provider outage must not hide other provider results. */ }
      finally {clearTimeout(timer);signal.removeEventListener('abort',abort);observer.onResult?.(outcome);}
    }
  }));
  return results;
}
