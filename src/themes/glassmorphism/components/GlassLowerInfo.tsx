/**
 * Glassmorphism Theme - LowerInfo Component
 *
 * Floating glass info cards with hover effects.
 */

import { BANNER2_ICON_MAP } from '@/components/branding/banner2Icons';
import type { LowerInfoProps } from '@/lib/themes/types';

export function GlassLowerInfo({ branding, lowerInfo }: LowerInfoProps) {
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    if (!lowerInfo?.enabled || !lowerInfo.cards || lowerInfo.cards.length === 0) return null;

    const items = lowerInfo.cards.filter((item) => item.enabled);
    if (items.length === 0) return null;

    return (
        <section
            className="py-20 relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, transparent 0%, ${primaryColor}08 50%, transparent 100%)`,
            }}
            data-branding-id="lower-info"
        >
            {/* Subtle background pattern */}
            <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(${primaryColor} 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                }}
            />

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((item, index) => {
                        const IconComponent = item.icon ? BANNER2_ICON_MAP[item.icon] : null;

                        return (
                            <div
                                key={item.id}
                                className="group p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-2"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    backdropFilter: 'blur(16px)',
                                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.6)',
                                    animationDelay: `${index * 150}ms`,
                                }}
                            >
                                {IconComponent && (
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}DD)`,
                                            boxShadow: `0 8px 24px ${primaryColor}30`,
                                        }}
                                    >
                                        <IconComponent className="w-8 h-8 text-white" />
                                    </div>
                                )}
                                <h3 className="text-xl font-bold mb-3 text-gray-900">
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {item.description}
                                </p>

                                {/* Decorative gradient line */}
                                <div
                                    className="mt-6 h-1 w-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{
                                        background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}40)`,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
