import { createContext, useContext } from "react";

export interface BrandingPaletteColors {
    primary?: string;
    secondary?: string;
    background?: string;
    card?: string;
    headingText?: string;
    bodyText?: string;
    pricingText?: string;
    linkText?: string;
    [key: string]: string | undefined;
}

export const BRANDING_PALETTE_LABELS: Record<string, string> = {
    primary: "Brand",
    secondary: "Sektion",
    background: "Baggrund",
    card: "Kort",
    headingText: "Overskrift",
    bodyText: "Brødtekst",
    pricingText: "Pris",
    linkText: "Link",
};

const BrandingPaletteContext = createContext<BrandingPaletteColors>({});

export function BrandingPaletteProvider({
    colors,
    children,
}: {
    colors: BrandingPaletteColors;
    children: React.ReactNode;
}) {
    return (
        <BrandingPaletteContext.Provider value={colors}>
            {children}
        </BrandingPaletteContext.Provider>
    );
}

export function useBrandingPalette(): BrandingPaletteColors {
    return useContext(BrandingPaletteContext);
}
