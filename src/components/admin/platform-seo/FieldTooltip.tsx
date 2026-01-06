/**
 * Field Tooltip Component
 * 
 * A small info icon with tooltip explaining what a field does.
 */

import { HelpCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface FieldTooltipProps {
    content: string;
    example?: string;
}

export function FieldTooltip({ content, example }: FieldTooltipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help ml-1 inline-block" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px] p-3" side="right">
                <p className="text-sm">{content}</p>
                {example && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-1.5 rounded">
                        Eksempel: {example}
                    </p>
                )}
            </TooltipContent>
        </Tooltip>
    );
}

export default FieldTooltip;
