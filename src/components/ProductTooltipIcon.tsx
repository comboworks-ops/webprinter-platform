import React, { useState } from 'react';
import { Info, HelpCircle, Lightbulb, Star, ExternalLink, X } from 'lucide-react';

export interface TooltipConfig {
    anchor: string;
    icon: 'info' | 'question' | 'lightbulb' | 'star';
    color: string;
    animation: 'fade' | 'slide' | 'bounce';
    text: string;
    link?: string;
}

interface ProductTooltipIconProps {
    config: TooltipConfig;
    className?: string;
}

export function ProductTooltipIcon({ config, className = '' }: ProductTooltipIconProps) {
    const [isOpen, setIsOpen] = useState(false);

    const IconComponent = {
        info: Info,
        question: HelpCircle,
        lightbulb: Lightbulb,
        star: Star,
    }[config.icon];

    const animationClass = {
        fade: 'animate-fade-in opacity-0',
        slide: 'animate-slide-up opacity-0',
        bounce: 'animate-bounce-in opacity-0',
    }[config.animation];

    return (
        <div className={`relative inline-flex ${className}`}>
            {/* Trigger Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-md"
                style={{ backgroundColor: config.color }}
                aria-label="Vis tooltip"
            >
                <IconComponent className="w-3 h-3" />
            </button>

            {/* Tooltip Popup */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Tooltip Content */}
                    <div
                        className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3 ${animationClass}`}
                        style={{
                            animationFillMode: 'forwards',
                            animationDuration: '0.2s'
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Content */}
                        <div className="pr-4">
                            <p className="text-sm leading-relaxed">{config.text}</p>

                            {config.link && (
                                <a
                                    href={config.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                >
                                    Læs mere
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>

                        {/* Arrow */}
                        <div
                            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                            style={{
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid white',
                            }}
                        />
                    </div>
                </>
            )}

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes bounce-in {
          0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
          100% { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        .animate-fade-in { animation-name: fade-in; }
        .animate-slide-up { animation-name: slide-up; }
        .animate-bounce-in { animation-name: bounce-in; }
      `}</style>
        </div>
    );
}
