/**
 * CollapsibleCard - A card that can be expanded/collapsed
 * Used for compact UI in settings panels
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface CollapsibleCardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
    className?: string;
}

export function CollapsibleCard({
    title,
    description,
    icon,
    defaultOpen = false,
    children,
    className,
}: CollapsibleCardProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={cn("overflow-hidden", className)}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 select-none">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {icon}
                                <div>
                                    <CardTitle className="text-base">{title}</CardTitle>
                                    {description && (
                                        <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                                    )}
                                </div>
                            </div>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                    isOpen && "rotate-180"
                                )}
                            />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-0">{children}</CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

export default CollapsibleCard;
