import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { fileChoices, saveWebVideo, type FileChoice } from '@/api/webDownload';
import type { PlaybackRequest, PlaybackSource } from '@/types/playback';
interface Props { isOpen:boolean;onClose:()=>void;request:PlaybackRequest|null;title:string;subtitle?:string;poster?:string;sources:PlaybackSource[];loading?:boolean;error?:string|null;onRetry?:()=>void }
export default function DownloadModal({isOpen,onClose,title,sources,loading,error,onRetry}:Props) {
  const [choices,setChoices]=useState<FileChoice[]>([]);const [selected,setSelected]=useState('');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [probing,setProbing]=useState(false);const [bytes,setBytes]=useState(0);
  const transfer=useRef<AbortController|null>(null);
  useEffect(()=>{if(!isOpen)return;const controller=new AbortController();setChoices([]);setProbing(true);setMessage('');
    void fileChoices(sources,controller.signal).then(items=>{if(!controller.signal.aborted){setChoices(items);setSelected(items[0]?.id||'');}}).finally(()=>{if(!controller.signal.aborted)setProbing(false);});return()=>controller.abort();},[isOpen,sources]);
  useEffect(()=>()=>transfer.current?.abort(),[]);
  if(!isOpen)return null;
  const choice=choices.find(item=>item.id===selected);
  const save=async()=>{if(!choice)return;const controller=new AbortController();transfer.current=controller;setBusy(true);setBytes(0);setMessage('');try {const saved=await saveWebVideo(choice,title,setBytes,controller.signal);setMessage(saved===undefined?'Handed to your browser download manager.':'Download saved.');}catch(e){setMessage(e instanceof Error?e.message:'Download interrupted.');}finally{setBusy(false);}};
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Download ${title}`}><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141217] p-6 text-white shadow-2xl"><div className="flex justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button aria-label="Close downloads" onClick={()=>{transfer.current?.abort();onClose();}}><X size={20}/></button></div><p className="mt-1 text-sm text-white/50">Save to your device</p>
    <div className="my-5 max-h-72 overflow-y-auto divide-y divide-white/10">{choices.map((item,index)=><label key={item.id} className="flex cursor-pointer items-center gap-3 py-4"><input type="radio" name="download-quality" disabled={busy} checked={selected===item.id} onChange={()=>setSelected(item.id)}/><span className="flex-1 font-semibold">{item.quality}<small className="block text-xs font-normal text-white/40">Cineverse {index+1}</small></span><span className="text-xs text-white/40">{item.size?`${(item.size/1e6).toFixed(1)} MB`:'Size unavailable'}</span></label>)}{!choices.length&&<p className="py-6 text-sm text-white/60">{loading||probing?'Finding download qualities…':error||'No compatible file returned for this title.'}</p>}</div>
    {choice?.blocked&&<p className="mb-3 text-xs text-white/50">{choice.blocked}</p>}
    {busy&&<p className="mb-3 text-sm">Saving · {(bytes/1e6).toFixed(1)} MB</p>}{message&&<p role="status" className="mb-3 text-sm text-white/70">{message}</p>}
    <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold p-4 font-bold text-black disabled:opacity-40" disabled={!choice||busy||!!choice.blocked} onClick={()=>void save()}><Download size={18}/>{busy?'Saving…':'Download'}</button>
    {!choices.length&&!loading&&!probing&&onRetry&&<button className="mt-3 w-full text-sm text-white/60" onClick={onRetry}>Try again</button>}
    {!choices.length&&!loading&&!probing&&<a href="/download" className="mt-3 block text-center text-sm text-gold">Get the Android app</a>}
    <p className="mt-4 text-xs leading-relaxed text-white/40">Keep this tab open while saving a stream. Some formats need the Android app. File sizes appear only when supplied by the source.</p>
  </section></div>;
}
