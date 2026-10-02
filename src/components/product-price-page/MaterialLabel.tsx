import type { ReactNode } from 'react';
import { ProductTooltipIcon, type TooltipConfig } from '@/components/ProductTooltipIcon';
import { materialPresentation, materialTooltipDefaults, type MaterialSource } from '@/lib/products/materialPresentation';

export function MaterialInfoIcons({ configs }: { configs: TooltipConfig[] }) {
  return <span className="inline-flex shrink-0 items-center gap-1" data-material-help>{configs.map(config => <ProductTooltipIcon key={config.anchor} config={config} />)}</span>;
}
export function MaterialLabel({ source, sectionId = 'legacy', valueId = source.name, tooltips = [] }: {
  source: MaterialSource; sectionId?: string; valueId?: string; tooltips?: TooltipConfig[];
}) {
  const presentation = materialPresentation(source);
  const configs = materialTooltipDefaults(source, sectionId, valueId).map(config => tooltips.find(item => item.anchor === config.anchor) || config);
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1.5" data-tooltip-anchor={`material-label:${sectionId}:${valueId}`}><span className="min-w-0 break-words">{presentation.label}</span>{configs.length > 0 && <MaterialInfoIcons configs={configs}/>}</span>;
}

/** Help controls are siblings so opening help never selects a material. */
export function MaterialOptionHelp({ source, sectionId, valueId, tooltips = [], enabled = true, children }: {
  source: MaterialSource; sectionId: string; valueId: string; tooltips?: TooltipConfig[]; enabled?: boolean; children: ReactNode;
}) {
  const configs = enabled ? materialTooltipDefaults(source, sectionId, valueId).map(config => tooltips.find(item => item.anchor === config.anchor) || config) : [];
  if (!configs.length) return children;
  return <span className="relative flex min-w-0 flex-col gap-1">{children}<span className="flex justify-end"><MaterialInfoIcons configs={configs}/></span></span>;
}
