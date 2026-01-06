/**
 * Cookie Settings Dialog
 * 
 * Full settings dialog with category toggles.
 * Premium bluish design matching the banner.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCookieConsent } from './CookieConsentProvider';
import { Cookie, Shield, BarChart3, Megaphone, Settings2 } from 'lucide-react';

interface CategoryToggle {
    id: 'preferences' | 'statistics' | 'marketing';
    label: string;
    description: string;
    icon: typeof Cookie;
}

const CATEGORIES: CategoryToggle[] = [
    {
        id: 'preferences',
        label: 'Præferencer',
        description: 'Husker dine valg og tilpasninger på siden.',
        icon: Settings2,
    },
    {
        id: 'statistics',
        label: 'Statistik',
        description: 'Hjælper os med at forstå hvordan siden bruges.',
        icon: BarChart3,
    },
    {
        id: 'marketing',
        label: 'Marketing',
        description: 'Bruges til at vise relevante annoncer.',
        icon: Megaphone,
    },
];

export function CookieSettingsDialog() {
    const { isSettingsOpen, closeSettings, consent, setCategories, acceptAll, rejectAll } = useCookieConsent();

    const [preferences, setPreferences] = useState(false);
    const [statistics, setStatistics] = useState(false);
    const [marketing, setMarketing] = useState(false);

    // Sync state with consent when dialog opens
    useEffect(() => {
        if (isSettingsOpen && consent) {
            setPreferences(consent.preferences);
            setStatistics(consent.statistics);
            setMarketing(consent.marketing);
        }
    }, [isSettingsOpen, consent]);

    const handleSave = () => {
        setCategories({ preferences, statistics, marketing });
    };

    return (
        <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && closeSettings()}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                {/* Blue gradient header */}
                <div
                    className="px-6 pt-6 pb-4"
                    style={{
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    }}
                >
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Cookie className="h-5 w-5 text-blue-600" />
                            </div>
                            <DialogTitle className="text-xl text-gray-900">Cookieindstillinger</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-600">
                            Vælg hvilke cookies du vil acceptere. Nødvendige cookies er altid aktive.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-4 space-y-3">
                    {/* Necessary - always on */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                                <Shield className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Nødvendige</p>
                                <p className="text-xs text-gray-500">
                                    Kræves for at siden kan fungere.
                                </p>
                            </div>
                        </div>
                        <Switch checked={true} disabled className="data-[state=checked]:bg-blue-500" />
                    </div>

                    {/* Configurable categories */}
                    {CATEGORIES.map((category) => {
                        const checked = category.id === 'preferences' ? preferences
                            : category.id === 'statistics' ? statistics
                                : marketing;
                        const setChecked = category.id === 'preferences' ? setPreferences
                            : category.id === 'statistics' ? setStatistics
                                : setMarketing;
                        const Icon = category.icon;

                        return (
                            <div
                                key={category.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                                        <Icon className="h-4 w-4 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{category.label}</p>
                                        <p className="text-xs text-gray-500">
                                            {category.description}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={checked}
                                    onCheckedChange={setChecked}
                                    className="data-[state=checked]:bg-blue-500"
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 bg-gray-50 border-t flex flex-col gap-3">
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleSave}
                        >
                            Gem valg
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-gray-300 text-gray-700"
                            onClick={rejectAll}
                        >
                            Kun nødvendige
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={acceptAll}
                        >
                            Accepter alle
                        </Button>
                    </div>

                    <div className="text-xs text-gray-500 text-center pt-2">
                        <Link to="/cookiepolitik" className="hover:text-blue-600 hover:underline" onClick={closeSettings}>
                            Cookiepolitik
                        </Link>
                        {' · '}
                        <Link to="/handelsbetingelser" className="hover:text-blue-600 hover:underline" onClick={closeSettings}>
                            Handelsbetingelser
                        </Link>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
