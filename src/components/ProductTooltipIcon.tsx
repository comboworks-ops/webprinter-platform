import '@/styles/productEditorUnified.css';
import { Info, HelpCircle, Lightbulb, Star, ExternalLink, Image, Heart, AlertCircle, CheckCircle, Leaf, Recycle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { safePresentationUrl } from '@/lib/products/productPresentation';
import type { TooltipTarget } from '@/lib/products/tooltipPlacement';

export interface TooltipConfig {
  anchor: string;
  title?: string;
  icon: 'info' | 'question' | 'lightbulb' | 'star' | 'image' | 'heart' | 'alert' | 'check' | 'leaf' | 'recycle';
  color: string;
  animation: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom';
  text: string;
  link?: string;
  imageUrl?: string;
  iconUrl?: string;
  imageAlt?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  target?: TooltipTarget;
}
const icons = {info:Info,question:HelpCircle,lightbulb:Lightbulb,star:Star,image:Image,heart:Heart,alert:AlertCircle,check:CheckCircle,leaf:Leaf,recycle:Recycle};
export function ProductTooltipIcon({ config, className = '' }: {config: TooltipConfig; className?: string}) {
  const Icon = icons[config.icon] || Info;
  const image = safePresentationUrl(config.imageUrl);
  const iconImage = safePresentationUrl(config.iconUrl);
  const link = safePresentationUrl(config.link);
  return <Popover><PopoverTrigger asChild><button type="button" data-tooltip-overlay aria-label={`Hjælp: ${config.title || config.target?.label || 'Læs mere'}`} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow focus-visible:outline focus-visible:outline-2 ${className}`} style={{backgroundColor:config.color || '#0EA5E9'}} onClick={event => event.stopPropagation()}>
    {iconImage ? <img src={iconImage} alt="" className="h-5 w-5 object-contain"/> : <Icon className="h-3.5 w-3.5"/>}
  </button></PopoverTrigger><PopoverContent data-tooltip-overlay side={config.side || 'top'} className="max-w-[calc(100vw-2rem)] space-y-3 text-sm motion-reduce:animate-none" aria-label={config.title || config.target?.label || 'Hjælp'} style={config.animation === 'none' ? {animation:'none'} : undefined} data-tooltip-effect={config.animation}>
    {config.title && <p className="font-semibold">{config.title}</p>}
    {image && <img src={image} alt={config.imageAlt || ''} className="max-h-60 w-full rounded object-contain"/>}
    <p className="whitespace-pre-wrap break-words">{config.text}</p>
    {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">Læs mere <ExternalLink size={12}/></a>}
  </PopoverContent></Popover>;
}
