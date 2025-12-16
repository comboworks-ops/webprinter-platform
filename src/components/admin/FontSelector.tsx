import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Popular Google Fonts curated for print/web businesses
const AVAILABLE_FONTS = [
    // Sans-serif - Modern & Clean
    { name: "Inter", category: "Sans-serif", description: "Modern & clean" },
    { name: "Poppins", category: "Sans-serif", description: "Geometric & bold" },
    { name: "Roboto", category: "Sans-serif", description: "Classic & readable" },
    { name: "Outfit", category: "Sans-serif", description: "Contemporary & fresh" },
    { name: "Montserrat", category: "Sans-serif", description: "Elegant & versatile" },
    { name: "Source Sans 3", category: "Sans-serif", description: "Adobe's open source" },
    { name: "DM Sans", category: "Sans-serif", description: "Geometric & modern" },
    { name: "Space Grotesk", category: "Sans-serif", description: "Tech & futuristic" },
    { name: "Nunito", category: "Sans-serif", description: "Rounded & friendly" },
    { name: "Open Sans", category: "Sans-serif", description: "Highly readable" },
    { name: "Lato", category: "Sans-serif", description: "Warm & stable" },
    { name: "Raleway", category: "Sans-serif", description: "Elegant & thin" },
    { name: "Work Sans", category: "Sans-serif", description: "Optimized for screens" },
    { name: "Rubik", category: "Sans-serif", description: "Slightly rounded" },
    { name: "Manrope", category: "Sans-serif", description: "Modern geometric" },
    { name: "Plus Jakarta Sans", category: "Sans-serif", description: "Fresh & contemporary" },
    { name: "Figtree", category: "Sans-serif", description: "Friendly & geometric" },
    { name: "Sora", category: "Sans-serif", description: "Tech-forward" },
    { name: "Urbanist", category: "Sans-serif", description: "Low contrast" },
    { name: "Lexend", category: "Sans-serif", description: "Improved readability" },

    // Serif - Premium & Traditional
    { name: "Playfair Display", category: "Serif", description: "Sophisticated & premium" },
    { name: "Lora", category: "Serif", description: "Elegant & readable" },
    { name: "Merriweather", category: "Serif", description: "Screen-optimized serif" },
    { name: "Libre Baskerville", category: "Serif", description: "Classic & legible" },
    { name: "Cormorant Garamond", category: "Serif", description: "Elegant display" },
    { name: "Crimson Pro", category: "Serif", description: "Book-style serif" },
    { name: "DM Serif Display", category: "Serif", description: "High-contrast display" },

    // Monospace - Code & Pricing
    { name: "Roboto Mono", category: "Monospace", description: "Great for pricing" },
    { name: "JetBrains Mono", category: "Monospace", description: "Developer favorite" },
    { name: "Fira Code", category: "Monospace", description: "Ligatures & clean" },
    { name: "IBM Plex Mono", category: "Monospace", description: "Corporate & precise" },
    { name: "Space Mono", category: "Monospace", description: "Retro-futuristic" },
];

interface FontSelectorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    description?: string;
}

export function FontSelector({ label, value, onChange, description }: FontSelectorProps) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vælg skrifttype" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                    {AVAILABLE_FONTS.map((font) => (
                        <SelectItem
                            key={font.name}
                            value={font.name}
                            className="py-3"
                        >
                            <div className="flex flex-col">
                                <span
                                    style={{ fontFamily: `'${font.name}', ${font.category.toLowerCase()}` }}
                                    className="text-base font-medium"
                                >
                                    {font.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {font.category} • {font.description}
                                </span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}

// Helper to generate Google Fonts link for dynamic loading
export function getGoogleFontsUrl(fonts: string[]): string {
    const uniqueFonts = [...new Set(fonts)].filter(Boolean);
    if (uniqueFonts.length === 0) return "";

    const fontFamilies = uniqueFonts
        .map(font => font.replace(/ /g, "+"))
        .map(font => `family=${font}:wght@400;500;600;700`)
        .join("&");

    return `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;
}

export { AVAILABLE_FONTS };
