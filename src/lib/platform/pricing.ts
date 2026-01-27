/**
 * Platform Pricing Configuration
 * 
 * This file contains subscription pricing tiers for the Platform marketing site.
 * 
 * TODO: If backend subscription pricing exists (e.g., subscription_tiers table),
 * replace this with a Supabase query. For now, these are static placeholder values.
 */

export interface PricingTier {
    id: string;
    name: string;
    monthlyPrice: number; // DKK per month
    yearlyPrice: number;  // DKK per year (discounted)
    description: string;
    features: string[];
    highlighted?: boolean; // For "most popular" styling
    cta: string;
}

/**
 * Platform subscription tiers.
 * TODO: Consider fetching from backend table if available.
 */
export const PRICING_TIERS: PricingTier[] = [
    {
        id: "starter",
        name: "Starter",
        monthlyPrice: 299,
        yearlyPrice: 2990, // ~17% discount
        description: "Perfekt til små trykkerier der vil starte online.",
        features: [
            "1 webshop",
            "Op til 50 produkter",
            "Basis prisberegner",
            "Email support",
            "SSL certifikat inkluderet",
        ],
        cta: "Start gratis prøveperiode",
    },
    {
        id: "professional",
        name: "Professional",
        monthlyPrice: 599,
        yearlyPrice: 5990, // ~17% discount
        description: "For voksende trykkerier med større behov.",
        features: [
            "1 webshop",
            "Ubegrænset produkter",
            "Avanceret prisberegner",
            "Online designer",
            "Priority email support",
            "Eget domæne",
            "CompanyHub (B2B portal)",
        ],
        highlighted: true,
        cta: "Start gratis prøveperiode",
    },
    {
        id: "enterprise",
        name: "Enterprise",
        monthlyPrice: 1499,
        yearlyPrice: 14990, // ~17% discount
        description: "Til større virksomheder med avancerede behov.",
        features: [
            "Flere webshops",
            "Ubegrænset produkter",
            "Fuld prisautomatisering",
            "Online designer + Soft Proof",
            "Phone + email support",
            "Dedikeret account manager",
            "API adgang",
            "CompanyHub (B2B portal)",
            "Whitelabel løsning",
        ],
        cta: "Kontakt os",
    },
];

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return price.toLocaleString('da-DK') + ' kr';
}
