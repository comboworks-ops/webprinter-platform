/**
 * InfoTooltip Component
 * 
 * A small question mark icon with tooltip for explaining UI elements.
 * Used throughout the branding/site designer to provide context.
 */

import { HelpCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
    content: string;
    className?: string;
}

export function InfoTooltip({ content, className = "" }: InfoTooltipProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help inline-block shrink-0 ${className}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] p-2.5" side="top">
                    <p className="text-xs leading-relaxed">{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default InfoTooltip;
