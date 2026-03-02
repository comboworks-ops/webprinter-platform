/**
 * Classic Theme - LowerInfo Component
 *
 * Info cards section below products.
 */

import type { CSSProperties } from 'react';
import { BANNER2_ICON_MAP } from '@/components/branding/banner2Icons';
import type { LowerInfoProps } from '@/lib/themes/types';

export function ClassicLowerInfo({ branding, lowerInfo }: LowerInfoProps) {
    if (!lowerInfo?.enabled || !lowerInfo.cards || lowerInfo.cards.length === 0) return null;

    const items = lowerInfo.cards.filter((item) => item.enabled);
    if (items.length === 0) return null;

    // Get full lowerInfo config from branding
    const lowerInfoConfig = branding?.forside?.lowerInfo;

    const bgType = lowerInfoConfig?.background?.type || 'solid';
    const bgStyle: CSSProperties = bgType === 'solid'
        ? { backgroundColor: lowerInfoConfig?.background?.color || '#F8FAFC' }
        : {
            backgroundImage: `linear-gradient(${lowerInfoConfig?.background?.gradientAngle ?? 135}deg, ${lowerInfoConfig?.background?.gradientStart || '#F8FAFC'}, ${lowerInfoConfig?.background?.gradientEnd || '#E2E8F0'})`,
        };

    const layout = lowerInfoConfig?.layout || 'grid';
    const gridClass = layout === 'stacked'
        ? 'grid grid-cols-1 gap-8'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';

    return (
        <section className="py-16" style={bgStyle} data-branding-id="lower-info">
            <div className="container mx-auto px-4">
                <div className={gridClass}>
                    {items.map((item) => {
                        const IconComponent = item.icon ? BANNER2_ICON_MAP[item.icon] : null;
                        const cardStyle = lowerInfoConfig?.cardStyle || 'elevated';
                        const cardClass = cardStyle === 'bordered'
                            ? 'border border-gray-200 bg-white'
                            : cardStyle === 'flat'
                                ? 'bg-transparent'
                                : 'bg-white shadow-lg';

                        return (
                            <div
                                key={item.id}
                                className={`rounded-xl p-6 ${cardClass}`}
                            >
                                {IconComponent && (
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                                        style={{
                                            backgroundColor: lowerInfoConfig?.iconBgColor || branding?.colors?.primary || '#0EA5E9',
                                        }}
                                    >
                                        <IconComponent
                                            className="w-6 h-6"
                                            style={{ color: lowerInfoConfig?.iconColor || '#FFFFFF' }}
                                        />
                                    </div>
                                )}
                                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                <p className="text-gray-600">{item.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
