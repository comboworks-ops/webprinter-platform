import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface HighlightBox {
    top: number;
    left: number;
    width: number;
    height: number;
    label: string;
}

export const PreviewInteractionManager = () => {
    const location = useLocation();
    const [highlight, setHighlight] = useState<HighlightBox | null>(null);
    const [isActive, setIsActive] = useState(false);

    // Check if we are in preview mode
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const isPreview = searchParams.get('preview_mode') === '1';
        setIsActive(isPreview);
    }, [location]);

    useEffect(() => {
        if (!isActive) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const brandingElement = target.closest('[data-branding-id]');

            if (brandingElement) {
                const rect = brandingElement.getBoundingClientRect();
                const id = brandingElement.getAttribute('data-branding-id') || '';

                setHighlight({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height,
                    label: id
                });

                e.stopPropagation();
            } else {
                setHighlight(null);
            }
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const brandingElement = target.closest('[data-branding-id]');

            if (brandingElement) {
                e.preventDefault();
                e.stopPropagation();

                const id = brandingElement.getAttribute('data-branding-id');
                console.log("🖱️ Preview Clicked:", id);

                // Send message to parent (Admin Editor)
                window.parent.postMessage({
                    type: 'EDIT_SECTION',
                    sectionId: id
                }, '*');
            }
        };

        const handleScroll = () => {
            setHighlight(null); // Clear highlight on scroll to avoid misalignment
        };

        // Use capture phase to ensure we catch events before any internal logic
        window.addEventListener('mouseover', handleMouseOver, true);
        window.addEventListener('click', handleClick, true);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            window.removeEventListener('mouseover', handleMouseOver, true);
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isActive]);

    if (!isActive || !highlight) return null;

    return (
        <div
            className="fixed z-[9999] pointer-events-none transition-all duration-150 ease-out border-2 border-primary shadow-[0_0_15px_rgba(14,165,233,0.3)] bg-primary/5"
            style={{
                top: highlight.top - window.scrollY, // Adjust for fixed positioning relative to viewport
                left: highlight.left - window.scrollX,
                width: highlight.width,
                height: highlight.height,
                borderRadius: '4px',
            }}
        >
            {/* Blinking Blue Dot Indicator */}
            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary shadow-sm border border-white"></span>
            </div>

            {/* Label Tag */}
            <div className="absolute -top-7 right-0 text-[10px] font-mono bg-primary text-white px-2 py-0.5 rounded shadow-sm opacity-90 uppercase tracking-wider">
                Redigér
            </div>
        </div>
    );
};
