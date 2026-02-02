import { useMemo } from 'react';
import { ProductTooltipIcon, type TooltipConfig } from './ProductTooltipIcon';

interface UseProductTooltipsProps {
    bannerConfig?: Record<string, any> | null;
}

export function useProductTooltips({ bannerConfig }: UseProductTooltipsProps) {
    const tooltips = useMemo(() => {
        if (!bannerConfig?.visual_tooltips) return [];
        return bannerConfig.visual_tooltips as TooltipConfig[];
    }, [bannerConfig]);

    const getTooltipForAnchor = (anchorId: string): TooltipConfig | undefined => {
        return tooltips.find(t => t.anchor === anchorId);
    };

    const renderTooltip = (anchorId: string, className?: string) => {
        const config = getTooltipForAnchor(anchorId);
        if (!config) return null;
        return <ProductTooltipIcon config={config} className={className} />;
    };

    // Higher-order component wrapper
    const withTooltip = (anchorId: string, children: React.ReactNode, wrapperClassName?: string) => {
        const tooltip = getTooltipForAnchor(anchorId);
        if (!tooltip) return children;

        return (
            <div className={`relative ${wrapperClassName || ''}`}>
                {children}
                <div className="absolute -top-1 -right-1">
                    <ProductTooltipIcon config={tooltip} />
                </div>
            </div>
        );
    };

    return {
        tooltips,
        getTooltipForAnchor,
        renderTooltip,
        withTooltip,
        hasTooltips: tooltips.length > 0,
    };
}

// Export the TooltipConfig type for convenience
export type { TooltipConfig };
