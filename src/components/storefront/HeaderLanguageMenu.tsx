import { useEffect, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { resolveLanguagePresentation, type LanguagePresentation, type MenuEntrance } from '@/lib/branding/headerMenuSettings';
import '@/styles/headerMenuMotion.css';

type Language = 'da' | 'en';
export function LanguageFlag({ language }: { language: Language }) {
  return language === 'da' ? <svg className="header-language-flag" aria-hidden="true" viewBox="0 0 20 14"><rect width="20" height="14" fill="#C8102E"/><rect x="6" width="2" height="14" fill="white"/><rect y="6" width="20" height="2" fill="white"/></svg>
    : <svg className="header-language-flag" aria-hidden="true" viewBox="0 0 20 14"><rect width="20" height="14" fill="#012169"/><path d="M0 0L20 14M20 0L0 14" stroke="white" strokeWidth="2.5"/><path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.5"/><path d="M10 0V14M0 7H20" stroke="white" strokeWidth="4"/><path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2"/></svg>;
}
const languageName = (value: Language) => value === 'da' ? 'Dansk' : 'English';

export function HeaderLanguageMenu({ preset, presentation, entrance, style, language, setLanguage, enabled, onCompactFocus }: {
  preset: string; presentation?: LanguagePresentation; entrance?: MenuEntrance; style: CSSProperties;
  language: string; setLanguage: (language: Language) => void; enabled: boolean; onCompactFocus: () => void;
}) {
  const mode = resolveLanguagePresentation(preset, presentation);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]);
  if (mode === 'segmented') return <div className="header-language-segmented" role="group" aria-label="Sprog" data-branding-id="header.actions">
    {(['da', 'en'] as const).map(value => <button type="button" key={value} aria-label={languageName(value)} aria-pressed={language === value} onClick={() => setLanguage(value)} className="header-action-link">{value.toUpperCase()}</button>)}
  </div>;
  return <DropdownMenu modal={false} open={enabled && open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild><Button variant="ghost" aria-label={language === 'da' ? 'Sprog: Dansk' : 'Language: English'} data-branding-id="header.actions" data-language-presentation={mode} className="header-language-trigger header-action-link">
      {mode === 'flag' || mode === 'cards' ? <LanguageFlag language={language === 'da' ? 'da' : 'en'} /> : mode === 'code' ? <span className="header-language-code">{language.toUpperCase()}</span> : <><span>{language === 'da' ? 'Dansk' : 'English'}</span><ChevronDown className="h-3 w-3" aria-hidden="true"/></>}
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="header-utility-panel" data-utility-kind="language" data-utility-preset={preset} data-language-presentation={mode} data-menu-entrance={entrance} style={style}
      onCloseAutoFocus={event => { if (!enabled) { event.preventDefault(); onCompactFocus(); } }}>
      <div className="header-utility-heading flex items-center gap-2"><Languages className="h-4 w-4" aria-hidden="true"/><strong>{language === 'da' ? 'Sprog' : 'Language'}</strong></div>
      <DropdownMenuRadioGroup className="header-language-options" value={language} onValueChange={value => setLanguage(value as Language)}>
        {(['da','en'] as const).map(value => <DropdownMenuRadioItem key={value} value={value} className="header-utility-item">
          {mode === 'flag' || mode === 'cards' ? <LanguageFlag language={value}/> : <span className="header-language-code">{value.toUpperCase()}</span>}
          <span>{languageName(value)}</span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function CompactLanguageChoices({ preset, presentation, language, setLanguage }: {
  preset: string; presentation?: LanguagePresentation; language: string; setLanguage: (language: Language) => void;
}) {
  const mode = resolveLanguagePresentation(preset, presentation);
  return <div data-branding-id="header.actions" className="header-utility-panel" data-utility-kind="language" data-utility-preset={preset} data-language-presentation={mode}>
    <div className="header-utility-heading flex items-center gap-2"><Languages className="h-4 w-4" aria-hidden="true"/><strong>{language === 'da' ? 'Sprog' : 'Language'}</strong></div>
    <div className="header-language-options" role="group" aria-label="Sprog">
      {(['da','en'] as const).map(value => <button type="button" key={value} className="header-utility-item" aria-label={languageName(value)} aria-pressed={language === value} onClick={() => setLanguage(value)}>
        {mode === 'flag' || mode === 'cards' ? <LanguageFlag language={value}/> : null}
        <span>{mode === 'code' || mode === 'segmented' ? value.toUpperCase() : languageName(value)}</span>
        {language === value && <Check className="header-utility-check h-4 w-4" aria-hidden="true"/>}
      </button>)}
    </div>
  </div>;
}
