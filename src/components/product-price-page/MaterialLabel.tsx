import type { ReactNode } from 'react';
import { ProductTooltipIcon, type TooltipConfig } from '@/components/ProductTooltipIcon';
import { materialPresentation, materialTooltipDefaults, type MaterialSource } from '@/lib/products/materialPresentation';
import { adhesiveTooltipDefault, adhesiveOptionLabel } from '@/lib/products/pixartAdhesivePresentation';
import { useLanguage } from '@/contexts/LanguageContext';

function defaults(source: MaterialSource, sectionId: string, valueId: string) {
  const adhesive = adhesiveTooltipDefault('materials', source, sectionId, valueId);
  return adhesive ? [adhesive] : materialTooltipDefaults(source, sectionId, valueId);
}

export function MaterialInfoIcons({ configs }: { configs: TooltipConfig[] }) {
  return <span className="inline-flex shrink-0 items-center gap-1" data-material-help>{configs.map(config => <ProductTooltipIcon key={config.anchor} config={config} />)}</span>;
}
export function MaterialLabel({ source, sectionId = 'legacy', valueId = source.name, tooltips = [] }: {
  source: MaterialSource; sectionId?: string; valueId?: string; tooltips?: TooltipConfig[];
}) {
  const presentation = materialPresentation(source);
  const { language } = useLanguage();
  const configs = defaults(source, sectionId, valueId).map(config => tooltips.find(item => item.anchor === config.anchor) || config);
  const label = adhesiveTooltipDefault('materials', source, sectionId, valueId) ? adhesiveOptionLabel('materials', source.sourceName || source.name, language) : presentation.label;
  return <span className="relative flex max-w-full items-start justify-between gap-2" data-tooltip-anchor={`material-label:${sectionId}:${valueId}`}><span className="min-w-0 break-words">{label}</span>{configs.length > 0 && <MaterialInfoIcons configs={configs}/>}</span>;
}

/** Help controls are siblings so opening help never selects a material. */
export function MaterialOptionHelp({ source, sectionId, valueId, tooltips = [], enabled = true, children }: {
  source: MaterialSource; sectionId: string; valueId: string; tooltips?: TooltipConfig[]; enabled?: boolean; children: ReactNode;
}) {
  const configs = enabled ? defaults(source, sectionId, valueId).map(config => tooltips.find(item => item.anchor === config.anchor) || config) : [];
  if (!configs.length) return children;
  return <span className="relative flex min-w-0 flex-col gap-1 pr-7">{children}<span className="absolute right-0 top-0"><MaterialInfoIcons configs={configs}/></span></span>;
}
