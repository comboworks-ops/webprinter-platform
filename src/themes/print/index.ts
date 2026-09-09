import { getTheme, registerTheme } from '@/lib/themes';
import '@/themes/classic';
import { DEFAULT_PRINT_DESIGN_ID, PRINT_DESIGN_PRESETS } from '@/lib/branding/printDesignPresets';
import { PrintHeader, PrintHero, PrintProductsSection, PrintShopLayout } from './PrintTheme';

const classic = getTheme('classic')!;
for (const preset of PRINT_DESIGN_PRESETS) {
  registerTheme({
    metadata: { id: preset.id, name: preset.name, description: preset.description, version: '1.0.0', author: 'Webprinter', tags: preset.id === DEFAULT_PRINT_DESIGN_ID ? ['Standard', 'Print'] : ['Print', 'Alternativ'] },
    components: { ...classic.components, Header: PrintHeader, HeroSlider: PrintHero, ProductsSection: PrintProductsSection, ShopLayout: PrintShopLayout },
    defaultSettings: { visualStyleId: preset.id },
    editorSections: [],
  });
}
