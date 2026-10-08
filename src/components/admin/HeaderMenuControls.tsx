import type { HeaderSettings } from '@/hooks/useBrandingDraft';
import { MENU_ENTRANCES, SEARCH_PRESENTATIONS, LANGUAGE_PRESENTATIONS, resolveMenuEntrance, type SearchPresentation, type LanguagePresentation } from '@/lib/branding/headerMenuSettings';
import { ColorPickerWithSwatches } from '@/components/ui/ColorPickerWithSwatches';

export function HeaderMenuControls({ header, onChange, savedSwatches, onSaveSwatch, onRemoveSwatch, primaryColor = '#087FC5' }: { primaryColor?: string; savedSwatches?: string[]; onSaveSwatch?: (color: string) => void; onRemoveSwatch?: (color: string) => void; header: Partial<HeaderSettings>; onChange: (patch: Partial<HeaderSettings>) => void }) {
  const entrance = resolveMenuEntrance(header.dropdownEntrance);
  return <section className="header-menu-controls space-y-4" aria-label="Fælles menuindstillinger">
    <div><h3 className="text-sm font-semibold">Fælles menuindstillinger</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Farver og åbning gælder Produkter, konto, søgning og sprog. Søgeform og sprogvisning følger menusættet, indtil du vælger noget andet.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-medium">Søgning
        <select aria-label="Søgningens form" className="flex min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={header.dropdownSearchPresentation || ''} onChange={event => onChange({ dropdownSearchPresentation: (event.target.value || undefined) as SearchPresentation | undefined })}>
          <option value="">Følg menusættet</option>{SEARCH_PRESENTATIONS.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium">Sprog
        <select aria-label="Sprogvælgerens form" className="flex min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={header.dropdownLanguagePresentation || ''} onChange={event => onChange({ dropdownLanguagePresentation: (event.target.value || undefined) as LanguagePresentation | undefined })}>
          <option value="">Følg menusættet</option>{LANGUAGE_PRESENTATIONS.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
    </div>
    <fieldset><legend className="mb-2 text-xs font-medium">Åbning af alle dropdowns</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {MENU_ENTRANCES.map(option => <button type="button" key={option.id} aria-pressed={entrance === option.id} className={`min-h-16 rounded-lg border p-3 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${entrance === option.id ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50'}`} onClick={() => onChange({ dropdownEntrance: option.id })}>
          <strong className="block font-semibold">{option.name}</strong><span className="mt-1 block leading-4 text-muted-foreground">{option.description}</span>
        </button>)}
      </div>
      <button type="button" className="mt-2 min-h-11 text-xs underline" onClick={() => onChange({ dropdownEntrance: undefined })}>Brug menusættets oprindelige bevægelse</button>
    </fieldset>
    <label className="block space-y-1 text-xs font-medium">Bevægelse i menuikoner
      <select aria-label="Bevægelse i menuikoner" className="min-h-11 w-full rounded-md border bg-background px-2 text-sm" value={header.dropdownIconMotion || 'none'} onChange={event => onChange({ dropdownIconMotion: event.target.value as HeaderSettings['dropdownIconMotion'] })}>
        <option value="none">Ingen bevægelse</option><option value="subtle">Roligt løft</option><option value="playful">Livligt bounce</option>
      </select><span className="block text-xs font-normal text-muted-foreground">Ved hover og tastaturfokus. Respekterer reduceret bevægelse.</span>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <ColorPickerWithSwatches savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch} label="Menu baggrund" value={header.dropdownBgColor || '#FFFFFF'} onChange={color => onChange({ dropdownBgColor: color })} />
      <ColorPickerWithSwatches savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch} label="Menu tekst" value={header.dropdownProductColor || '#1F2937'} onChange={color => onChange({ dropdownProductColor: color })} />
      <ColorPickerWithSwatches savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch} label="Menu hover / valgt" value={header.dropdownHoverColor || '#EFF6FC'} onChange={color => onChange({ dropdownHoverColor: color })} />
      <ColorPickerWithSwatches savedSwatches={savedSwatches} onSaveSwatch={onSaveSwatch} onRemoveSwatch={onRemoveSwatch} label="Menu markering" value={header.dropdownAccentColor || primaryColor} onChange={color => onChange({ dropdownAccentColor: color })} />
    </div>
  </section>;
}
