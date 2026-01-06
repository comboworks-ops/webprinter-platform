/**
 * Cookie Consent Banner
 * 
 * Small, discrete banner fixed to bottom-left corner.
 * Premium bluish design that feels natural, not system-generated.
 */

import { Button } from '@/components/ui/button';
import { useCookieConsent } from './CookieConsentProvider';
import { Cookie } from 'lucide-react';

export function CookieBanner() {
    const { isBannerVisible, acceptAll, rejectAll, openSettings } = useCookieConsent();

    if (!isBannerVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 z-[100] max-w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div
                className="rounded-xl shadow-2xl border border-blue-200/50 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 50%, #dbeafe 100%)',
                }}
            >
                {/* Top accent bar */}
                <div
                    className="h-1"
                    style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)' }}
                />

                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Cookie className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                Cookieindstillinger
                            </h4>
                            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                                Vi bruger cookies til at forbedre din oplevelse på siden.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    onClick={acceptAll}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                >
                                    Accepter alle
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={rejectAll}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                >
                                    Kun nødvendige
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={openSettings}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                    Tilpas
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
