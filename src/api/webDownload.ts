import type { PlaybackSource } from '@/types/playback';
export type FileChoice = { id: string; url: string; quality: string; source: PlaybackSource; size?: number; blocked?: string };
const attributes = (text: string) => Object.fromEntries([...text.matchAll(/([A-Z-]+)=(?:"([^"]*)"|([^,]+))/g)].map((m) => [m[1], m[2] ?? m[3]]));
export async function fileChoices(sources: PlaybackSource[], signal: AbortSignal): Promise<FileChoice[]> {
  const groups = await Promise.all(sources.map(async (source): Promise<FileChoice[]> => {
    if (source.contentType === 'dash') return [];
    if (source.contentType !== 'hls') {
      let size: number | undefined;
      try {const response=await fetch(source.url,{method:'HEAD',signal});const length=Number(response.headers.get('Content-Length'));if(response.ok&&length>0)size=length;}catch{}
      return [{ id:source.id,url:source.url,quality:source.quality,source,size }];
    }
    try {
      const response=await fetch(source.url,{signal}); if(!response.ok) return [];
      const text=await response.text();const lines=text.split(/\r?\n/).map(line=>line.trim());
      const variants:FileChoice[]=[];
      lines.forEach((line,index)=>{
        if(!line.startsWith('#EXT-X-STREAM-INF:') || !lines[index+1] || lines[index+1].startsWith('#')) return;
        const attrs=attributes(line);const size=attrs.RESOLUTION?.split('x').map(Number);
        const height=size ? size[0]>=1920 ? Math.max(size[1],1080) : size[1] : 0;
        variants.push({id:`${source.id}-${index}`,url:new URL(lines[index+1],response.url).href,quality:height?`${height}p`:source.quality,source,
          blocked:attrs.AUDIO ? 'Separate audio tracks require the Android app for complete offline packaging.' : undefined});
      });
      return variants.length?variants:[{id:source.id,url:source.url,quality:source.quality,source}];
    } catch{return [];}
  }));
  return groups.flat().sort((a,b)=>(parseInt(b.quality)||0)-(parseInt(a.quality)||0));
}
export async function saveWebVideo(choice:FileChoice,title:string,onProgress:(bytes:number)=>void,signal:AbortSignal) {
  if(choice.blocked) throw new Error(choice.blocked);
  const picker=(window as unknown as {showSaveFilePicker?:(options:object)=>Promise<{createWritable:()=>Promise<{write:(bytes:Uint8Array)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>}).showSaveFilePicker?.bind(window);
  const filename=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);
  if(!picker) {
    if(choice.source.contentType==='hls') throw new Error('Saving this stream needs Chrome or Edge on desktop, or the Cineverse Android app.');
    const link=document.createElement('a');link.href=choice.url;link.download=filename+'.mp4';link.rel='noopener';link.click();return;
  }
  // Ask for the file while the click still has browser user activation.
  const handle=await picker({suggestedName:filename+(choice.source.contentType==='hls'?'.ts':'.mp4')});
  const output=await handle.createWritable();let bytes=0;
  try {
    const copy=async(url:string)=>{
      const response=await fetch(url,{signal});if(!response.ok || !response.body) throw new Error('The source stopped responding.');
      const reader=response.body.getReader();try {while(true){const next=await reader.read();if(next.done)break;await output.write(next.value);bytes+=next.value.length;onProgress(bytes);}}finally{reader.releaseLock();}
    };
    if(choice.source.contentType==='hls') {
      const response=await fetch(choice.url,{signal});if(!response.ok)throw new Error('Cannot read this stream.');const text=await response.text();
      if(!text.includes('#EXT-X-ENDLIST') || /#EXT-X-(?:KEY|MAP|BYTERANGE|DISCONTINUITY):/.test(text) || /#EXT-X-STREAM-INF:/.test(text)) throw new Error('This stream needs complete offline packaging. Use the Cineverse Android app for this source.');
      for(const line of text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line && !line.startsWith('#'))) await copy(new URL(line,response.url).href);
    } else await copy(choice.url);
    await output.close();return bytes;
  } catch(error){await output.abort().catch(()=>{});throw error;}
}
