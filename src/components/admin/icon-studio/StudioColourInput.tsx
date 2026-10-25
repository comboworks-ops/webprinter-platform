import { useEffect, useId, useState } from 'react';
const HEX = /^#[0-9a-f]{6}$/i;

/** Keep partial text editable while only committing valid recipe colours. */
export function StudioColourInput({label,value,onChange}:{label:string;value:string;onChange:(colour:string)=>void}) {
  const id=useId();
  const [text,setText]=useState(value);
  useEffect(()=>setText(value),[value]);
  const valid=HEX.test(text);
  return <div className="studio-colour-field">
    <label htmlFor={id}>{label}</label>
    <div className="studio-colour-inputs">
      <input type="color" aria-label={`${label} · farvevælger`} value={value} onChange={e=>{setText(e.target.value);onChange(e.target.value);}}/>
      <input id={id} type="text" aria-label={`${label} · hexkode`} value={text} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!valid} aria-describedby={!valid?`${id}-error`:undefined} onChange={e=>{const next=e.target.value;setText(next);if(HEX.test(next))onChange(next.toLowerCase());}} onBlur={()=>{if(!valid)setText(value);}}/>
    </div>
    {!valid&&<span id={`${id}-error`} className="text-xs text-destructive">Brug # og seks tegn, fx #00afd2.</span>}
  </div>;
}
