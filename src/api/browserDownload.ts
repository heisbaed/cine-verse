import type { FileChoice } from './webDownload';

const scope = import.meta.env.DEV ? '/src/media-download/' : '/media-download/';

async function downloadWorker() {
  if (!navigator.serviceWorker) throw new Error('This browser cannot save segmented video as one MP4.');
  const script = import.meta.env.DEV ? '/src/media-download/worker.ts' : scope + 'worker.js';
  const reg = await navigator.serviceWorker.register(script, { type: 'module', scope });
  if (reg.active?.state === 'activated') return reg.active;
  const worker = reg.installing ?? reg.waiting ?? reg.active;
  if (!worker) throw new Error('The download service could not start.');
  await new Promise<void>((resolve, reject) => {
    function changed() {
      if (worker!.state === 'activated' || worker!.state === 'redundant') {
        worker!.removeEventListener('statechange', changed);
        if (worker!.state === 'activated') resolve();
        else reject(new Error('The download service did not activate.'));
      }
    }
    worker.addEventListener('statechange', changed);
    changed();
  });
  return worker;
}

export async function downloadSourceAsFile(choice: FileChoice, title: string) {
  const name = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 140) || 'Cineverse';
  const target = new URL(choice.url);
  if (choice.source.contentType !== 'hls' && target.pathname === '/proxy' && target.searchParams.has('sig')) {
    target.pathname = '/download';
    const extension = new URL(target.searchParams.get('u')!).pathname.match(/\.(mp4|mkv|webm|mov|m4v)$/i)?.[0] ?? '.mp4';
    target.searchParams.set('name', name + extension);
    // The server sends Content-Disposition: attachment. The browser owns the transfer.
    const link = document.createElement('a');
    link.href = target.href;
    link.download = name + extension;
    link.click();
    return;
  }

  const worker = await downloadWorker();
  const channel = new MessageChannel();
  const ticket = crypto.randomUUID();
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The source took too long to prepare. Try another quality.')), 75_000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      if (data.ready) resolve();
      else reject(new Error(data.error || 'This source cannot be saved.'));
    };
  });
  worker.postMessage({ ticket, url: target.href, audioUrl: choice.audioUrl, name, hls: choice.source.contentType === 'hls' }, [channel.port2]);
  try {
    await ready;
    // Navigation under the worker scope supplies one HTTP attachment to the download manager.
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Movie download';
    frame.src = scope + ticket;
    document.body.appendChild(frame);
    setTimeout(() => frame.remove(), 120_000);
  } finally { channel.port1.close(); }
}
