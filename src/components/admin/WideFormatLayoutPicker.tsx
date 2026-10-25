import { Check } from 'lucide-react';
import { SIGNAL_CHOICES, signalSettings, type SignalSettings } from '@/lib/branding/pvcbannerSettings';
export type WideLayoutField = 'configurationStyle'|'checkoutStyle'|'contactLayout';
/** Small layout diagrams distinguish compositions without rendering live checkout forms. */
export function WideFormatLayoutPicker({branding,field,onChange}: {branding:{themeSettings?:Record<string,unknown>};field:WideLayoutField;onChange:(patch:Partial<SignalSettings>)=>void}) {
 const b=signalSettings(branding);
 const selected=field==='configurationStyle'&&b.sharedCalculatorLayout ? '' : b[field];
 return <fieldset className="sd-wide-layouts"><legend>{field==='configurationStyle'?'Produktets betjening':field==='checkoutStyle'?'Storformat checkout':'Kontaktformular'}</legend><div>{SIGNAL_CHOICES[field]?.map(([value,label],index)=><button type="button" key={value} aria-label={`${field==='configurationStyle'?'Konfiguration':field==='checkoutStyle'?'Checkoutlayout':'Kontaktlayout'}: ${label}`} aria-pressed={selected===value} onClick={()=>onChange({...{[field]:value},...(field==='configurationStyle'?{sharedCalculatorLayout:false}:{})})}>
  <svg viewBox="0 0 160 90" aria-hidden="true"><rect x="1" y="1" width="158" height="88" rx="3" fill={value==='cinematic'?'#172225':'#f5f7f9'}/><rect x="10" y="10" width="70" height="4" fill="#243646"/>{value==='sliders'?<>{[30,50,70].map((y,i)=><g key={y}><rect x="16" y={y} width="126" height="3" fill="#bdc8d0"/><circle cx={45+i*25} cy={y+1} r="5" fill="#087fc5"/></g>)}</>:value==='buttons'||value==='topics'||value==='project'?<>{[0,1,2].map(n=><rect key={n} x={12+n*47} y="26" width="41" height="18" rx="3" fill={n===0?'#087fc5':'#dfe6eb'}/>)}<rect x="12" y="53" width="135" height="25" fill="white" stroke="#ccd6de"/></>:<>{[0,1,2].map(n=><rect key={n} x={value==='document'?12:14} y={24+n*17} width={value==='document'?135:index%2===0?78:60} height="11" rx="2" fill="white" stroke="#ccd6de"/>)}{value!=='document'&&<rect x={index%2===0?103:87} y="24" width={index%2===0?43:59} height="49" rx="2" fill="#dce9f2"/>}</>}</svg>
  <span>{label}{selected===value&&<Check size={13}/>}</span>
 </button>)}</div></fieldset>;
}
