import type { CSSProperties } from 'react';
import { Check, Package, Search, User } from 'lucide-react';
import type { HeaderDropdownPreset } from '@/lib/branding/dropdownPresets';
import { resolveSearchPresentation, resolveLanguagePresentation, type SearchPresentation, type LanguagePresentation } from '@/lib/branding/headerMenuSettings';
import { LanguageFlag } from './HeaderLanguageMenu';
import '@/styles/headerUtilityMenus.css';

/** Non-interactive companions in the existing menu design picker. */
export function HeaderUtilityPreview({ preset, style, searchPresentation, languagePresentation }: { preset: HeaderDropdownPreset; style?: CSSProperties; searchPresentation?: SearchPresentation; languagePresentation?: LanguagePresentation }) {
  const search = resolveSearchPresentation(preset, searchPresentation);
  const language = resolveLanguagePresentation(preset, languagePresentation);
  return <div className="header-utility-preview" data-utility-preset={preset} style={style} aria-hidden="true">
    <div className="header-utility-panel" data-utility-preset={preset}>
      <div className="header-utility-heading"><strong>Min konto</strong></div>
      {preset === 'tabbed-explorer' && <div className="header-preview-tabs"><span>Konto</span><span>Ordrer</span></div>}
      <div className="header-utility-items">
        <span className="header-utility-item"><User size={16} />Min konto</span>
        <span className="header-utility-item"><Package size={16} />Mine ordrer</span>
      </div>
    </div>
    <div className="header-utility-preview-tools">
      <div className="header-utility-panel header-utility-preview-language" data-utility-preset={preset} data-utility-kind="language" data-language-presentation={language}>
        <div className="header-utility-heading"><strong>Sprog</strong></div>
        <div className="header-language-options">
          {(['da', 'en'] as const).map(value => <span key={value} className="header-utility-item" data-state={value === 'da' ? 'checked' : undefined}>
            {(language === 'flag' || language === 'cards') && <LanguageFlag language={value}/>}
            {language === 'code' || language === 'segmented' ? value.toUpperCase() : value === 'da' ? 'Dansk' : 'English'}{value === 'da' && <Check size={12}/>}
          </span>)}
        </div>
      </div>
      <div className="header-utility-preview-search" data-utility-preset={preset}>
        <div className="storefront-header-search-field"><Search size={16} /><span>{search === 'compact' ? 'Skriv først…' : search === 'command' ? '⌘ K · Søg' : 'Søg produkter…'}</span></div>
        <div className="header-utility-panel" data-utility-preset={preset} data-search-presentation={search}>
          {search === 'categories' && <div className="header-preview-tabs"><span>Alle</span><span>Tryksager</span></div>}
          <div className="header-search-results-list"><span className="header-utility-item"><Package size={16} />{search === 'compact' ? 'Resultater' : 'Visitkort'}</span>{search === 'visual' && <span className="header-utility-item"><Package size={16}/>Flyers</span>}</div>
        </div>
      </div>
    </div>
  </div>;
}
