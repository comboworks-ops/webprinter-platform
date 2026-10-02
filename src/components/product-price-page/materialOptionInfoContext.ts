import { createContext, useContext } from 'react';
import type { TooltipConfig } from '@/components/ProductTooltipIcon';

export const MaterialOptionInfoContext = createContext<Record<string, TooltipConfig[]>>({});
export function useMaterialOptionInfo(target?: string) {
  const entries = useContext(MaterialOptionInfoContext);
  return target ? Object.entries(entries).find(([prefix]) => target.startsWith(prefix))?.[1] : undefined;
}
