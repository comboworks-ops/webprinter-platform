import { useEffect, useId, useState } from 'react';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { BUTTON_EFFECTS, buttonStyleVariables, canonicalButtonKey, legacyButtonStyle, legacyLocalButtonStyle, readSharedButtons, resolveSharedButton, sharedButtonAttributes, sharedButtonsPatch, type SharedButtonRole, type SharedButtonStyle } from '@/lib/branding/sharedButtons';
import '@/styles/sharedButtons.css';
import '@/styles/sharedButtonsEditor.css';

type Props = { draft: BrandingData; updateDraft: (patch: Partial<BrandingData>) => void; designDefaults?: BrandingData };
const roles = { cta: 'CTA / bestilling', selection: 'Valgknapper' };
const colors = [
  ['bgColor', 'Baggrund · normal'], ['textColor', 'Tekstfarve · normal'], ['hoverBgColor', 'Baggrund · hover'],
  ['hoverTextColor', 'Tekstfarve · hover'], ['selectedBgColor', 'Baggrund · valgt'], ['selectedTextColor', 'Tekstfarve · valgt'],
] as const;
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [code, setCode] = useState(value);
  useEffect(() => setCode(value), [value]);
  return <label className="sb-color-control"><span>{label}</span><span><input type="color" aria-label={label} value={value} onChange={event => onChange(event.target.value)} /><input aria-label={`${label} farvekode`} value={code} maxLength={7} aria-invalid={!/^#[\da-f]{6}$/i.test(code)} onChange={event => { setCode(event.target.value); if (/^#[\da-f]{6}$/i.test(event.target.value)) onChange(event.target.value); }} onBlur={() => setCode(value)} onFocus={event => event.target.select()} /></span></label>;
}
function StyleFields({ value, role, onChange }: { value: SharedButtonStyle; role: SharedButtonRole; onChange: (patch: Partial<SharedButtonStyle>) => void }) {
  return <>
    <p className="sd-control-note">Normal er knappens farver uden musen over. Hover bruges også ved tastaturfokus.</p>
    <div className="sb-color-grid">{colors.slice(0, role === 'selection' ? 6 : 4).map(([key, label]) => <ColorField key={key} label={label} value={value[key]} onChange={color => onChange({ [key]: color })} />)}</div>
    <ColorField label="Kantfarve" value={value.borderColor} onChange={borderColor => onChange({ borderColor })} />
    <label className="sd-control-field"><span>Runde hjørner · {value.radiusPx} px</span><input type="range" min={0} max={48} value={value.radiusPx} onChange={event => onChange({ radiusPx: Number(event.target.value) })} /></label>
    <label className="sd-control-field"><span>Tekststørrelse · {value.fontSizePx} px</span><input type="range" min={12} max={24} value={value.fontSizePx} onChange={event => onChange({ fontSizePx: Number(event.target.value) })} /></label>
    <label className="sd-control-field"><span>Luft over og under tekst · {value.paddingYPx} px</span><input type="range" min={6} max={24} value={value.paddingYPx} onChange={event => onChange({ paddingYPx: Number(event.target.value) })} /></label>
  </>;
}
function EffectPicker({ value, role, onChange }: { value: SharedButtonStyle; role: SharedButtonRole; onChange: (patch: Partial<SharedButtonStyle>) => void }) {
  return <>
    <div className="sb-effects" role="group" aria-label="Vælg knapeffekt">{BUTTON_EFFECTS.map(effect => <button type="button" key={effect.id} className="sb-effect-card" aria-pressed={value.effect === effect.id} onClick={() => onChange({ effect: effect.id })} title={effect.description}>
      <span className="sb-effect-sample" {...sharedButtonAttributes({ ...value, effect: effect.id, idleMotion: false }, role)}>{effect.name}</span>
    </button>)}</div>
    <p className="sb-effect-description">{BUTTON_EFFECTS.find(effect => effect.id === value.effect)?.description} Prøv effekten på knappen i butikkens preview.</p>
    {['sheen', 'aurora', 'orbit', 'breathe'].includes(value.effect) && <label className="sd-control-toggle"><input type="checkbox" checked={value.idleMotion} onChange={event => onChange({ idleMotion: event.target.checked })} /><span>Diskret bevægelse, også uden hover</span></label>}
    <p className="sd-control-note">10 effekter · også med tastatur og støtte for reduceret bevægelse.</p>
  </>;
}
export function SharedButtonsControls({ draft, updateDraft, designDefaults }: Props) {
  const [role, setRole] = useState<SharedButtonRole>('cta');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState<'appearance' | 'effects' | 'bank'>('appearance');
  const id = useId();
  const settings = readSharedButtons(draft);
  const value = settings[role] || legacyButtonStyle(draft, role);
  const change = (patch: Partial<SharedButtonStyle>) => updateDraft(sharedButtonsPatch(draft, { ...settings, [role]: { ...value, ...patch } }));
  const entries = settings.bank.filter(entry => entry.role === role);
  return <div className="sd-quick-controls sb-editor">
    <div className="sb-role-tabs" role="group" aria-label="Knaptype">{(['cta', 'selection'] as const).map(key => <button type="button" key={key} aria-pressed={role === key} onClick={() => { setRole(key); setNotice(''); }}>{roles[key]}</button>)}</div>
    <p className="sd-control-note">Se ændringerne i butikkens preview.{!settings[role] && ' Første ændring aktiverer fælles design.'}</p>
    <div className="sb-panel-tabs" role="group" aria-label="Knapindstillinger">{([['appearance', 'Farver & form'], ['effects', 'Effekter'], ['bank', 'Knapbank']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={panel === key} onClick={() => setPanel(key)}>{label}{key === 'bank' && entries.length > 0 && <small> {entries.length}</small>}</button>)}</div>
    <div className="sb-panel-content" key={role}>
    {panel === 'appearance' && <StyleFields value={value} role={role} onChange={change} />}
    {panel === 'effects' && <EffectPicker value={value} role={role} onChange={change} />}
    {panel === 'bank' && <div className="sb-bank"><p className="sd-control-note">Gem og genbrug knappens design. Banken gemmes med kladden.</p>
      <label htmlFor={`${id}-name`}>Navn på knapdesign</label><input id={`${id}-name`} placeholder="Fx Ocean · blå vandfyld" maxLength={80} value={name} onChange={event => setName(event.target.value)} />
      <button type="button" className="sb-secondary" disabled={!name.trim() || settings.bank.length >= 100} onClick={() => { updateDraft(sharedButtonsPatch(draft, { ...settings, bank: [...settings.bank, { id: crypto.randomUUID(), name: name.trim(), role, style: { ...value } }] })); setNotice('Tilføjet til knapbanken i kladden. Brug Gem kladde for at gemme den.'); setName(''); }}>＋ Gem i knapbank</button>
      {entries.length === 0 && <p className="sd-control-note">Ingen gemte {role === 'cta' ? 'CTA-designs' : 'valgknapper'} endnu.</p>}
      {entries.map(entry => <div className="sb-bank-entry" key={entry.id}><span aria-hidden="true" {...sharedButtonAttributes(entry.style, role)}>Aa</span><strong>{entry.name}</strong><button type="button" className="sb-secondary" aria-label={`Brug ${entry.name}`} onClick={() => { change(entry.style); setNotice(`${entry.name} er anvendt på ${roles[role].toLowerCase()}.`); }}>Brug</button><button type="button" className="sb-remove" aria-label={`Fjern ${entry.name} fra knapbank`} onClick={() => updateDraft(sharedButtonsPatch(draft, { ...settings, bank: settings.bank.filter(item => item.id !== entry.id) }))}>×</button></div>)}
    </div>}
    </div>
    <button type="button" className="sb-secondary sb-reset" onClick={() => { const defaults = legacyButtonStyle(designDefaults || draft, role); updateDraft(sharedButtonsPatch(draft, { ...settings, [role]: defaults })); setNotice('Knaptypen er nulstillet til det valgte shopdesign. Låste knapper og banken er bevaret.'); }}>↺ Nulstil {role === 'cta' ? 'CTA' : 'valgknapper'} til shopdesign</button>
    {notice && <p role="status" className="sd-control-note">{notice}</p>}
    <p className="sd-control-note">Særlige knapper kan låses i deres egne indstillinger.</p>
  </div>;
}

/** A saved snapshot makes a local exception stable across future master edits. */
export function SharedButtonLocalControls({ draft, updateDraft, buttonKey, role, title }: Props & { buttonKey: string; role: SharedButtonRole; title: string }) {
  const key = canonicalButtonKey(buttonKey);
  const settings = readSharedButtons(draft);
  const locked = Boolean(settings.overrides[key]);
  const value = settings.overrides[key]?.style || resolveSharedButton(draft, role, key) || legacyLocalButtonStyle(draft, role, key);
  const change = (style: SharedButtonStyle) => updateDraft(sharedButtonsPatch(draft, { ...settings, overrides: { ...settings.overrides, [key]: { role, style } } }));
  return <div className="sd-quick-controls sb-local-lock">
    <label className="sd-control-toggle"><input type="checkbox" checked={locked} onChange={event => { if (event.target.checked) change({ ...value }); else { const overrides = { ...settings.overrides }; delete overrides[key]; updateDraft(sharedButtonsPatch(draft, { ...settings, overrides })); } }} /><span>Lås {title} fra Fælles knapper</span></label>
    <p className="sd-control-note">{locked ? 'Denne knap har sit eget design. Ændringer og nulstilling under Fælles knapper påvirker den ikke.' : 'Følger Fælles knapper, når knaptypen er aktiv. Lås for at bevare og tilpasse et særligt design.'}</p>
    {locked && <details><summary>Tilpas den låste knap</summary><div className="sb-local-fields"><span aria-hidden="true" {...sharedButtonAttributes(value, role)} style={buttonStyleVariables(value)}>Prøv knappen</span><StyleFields value={value} role={role} onChange={patch => change({ ...value, ...patch })} /><EffectPicker value={value} role={role} onChange={patch => change({ ...value, ...patch })} /></div></details>}
  </div>;
}
