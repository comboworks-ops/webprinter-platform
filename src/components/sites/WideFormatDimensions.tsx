import { useEffect, useState } from 'react';
/** Slider commits at the end of a gesture, so dragging does not flood price requests. */
export function DimensionSlider({label,value,onCommit}: {label:string;value:number;onCommit:(value:number)=>void}) {
  const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  return <label className="wide-dimension-slider"><span>{label}<output>{draft} cm</output></span><input type="range" min={1} max={Math.max(1000,value)} step={1} aria-label={`${label} med skyder`} value={draft} onChange={event=>setDraft(Number(event.target.value))} onPointerUp={event=>onCommit(Number(event.currentTarget.value))} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))onCommit(Number(event.currentTarget.value));}} onBlur={()=>{if(draft!==value)onCommit(draft);}}/></label>;
}
