import { cn } from "@/lib/utils";

// Product preset definitions
export const PRODUCT_PRESETS = [
    {
        key: "offset",
        label: "Offset Tryksager",
        description: "Standard offset/litho produkter",
        icon: "📄",
        imageUrl: "/offsetprintWebPrinter.png",
    },
    {
        key: "wide_format",
        label: "Storformat",
        description: "Stort format print",
        icon: "🖼️",
        imageUrl: "/StorformatWebPrinter.png",
    },
    {
        key: "digital",
        label: "Digital Print",
        description: "Digitalt tryk produkter",
        icon: "🖨️",
        imageUrl: "/Digitalprintwebprinter.png",
    },
    {
        key: "textile",
        label: "Tekstil Print",
        description: "Tekstil & stof print",
        icon: "👕",
        imageUrl: "/TextileWebPrinter.png",
    },
    {
        key: "physical",
        label: "Fysiske Produkter",
        description: "Skilte, telte, messeprodukter",
        icon: "🪧",
        imageUrl: "/Messeudstyr- Webprinter .png",
    },
    {
        key: "book",
        label: "Bøger & Hæfter",
        description: "Bøger, magasiner, hæfter",
        icon: "📚",
        imageUrl: "/Bogbinder webprinter.png",
    },
    {
        key: "packaging",
        label: "Emballage",
        description: "Emballage produkter",
        icon: "📦",
        imageUrl: "/TakeawayWebprinter.png",
    },
    {
        key: "boards",
        label: "Plademateriale",
        description: "Stive plader, skilte",
        icon: "🪵",
        imageUrl: "/Flatbed web printerIcon.png",
    },
    {
        key: "custom",
        label: "Brugerdefineret",
        description: "Manuel opsætning",
        icon: "⚙️",
        imageUrl: "/brugedefineret. Knapp.png",
    },
] as const;

export type PresetKey = typeof PRODUCT_PRESETS[number]["key"];

interface ProductPresetSelectorProps {
    value: PresetKey;
    onChange: (key: PresetKey) => void;
}

export function ProductPresetSelector({ value, onChange }: ProductPresetSelectorProps) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
                {PRODUCT_PRESETS.map((preset) => (
                    <button
                        key={preset.key}
                        type="button"
                        onClick={() => onChange(preset.key)}
                        className={cn(
                            "group relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all text-center min-h-[90px] overflow-hidden",
                            "hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
                            value === preset.key
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                : "border-border bg-card"
                        )}
                    >
                        {'imageUrl' in preset && preset.imageUrl ? (
                            <img
                                src={preset.imageUrl}
                                alt={preset.label}
                                className="w-[100px] h-[100px] object-contain mb-1 transition-transform duration-300 ease-out group-hover:scale-150"
                            />
                        ) : (
                            <span className="text-6xl mb-1 transition-transform duration-300 ease-out group-hover:scale-110">{preset.icon}</span>
                        )}
                        <span className="text-sm font-medium">{preset.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                            {preset.description}
                        </span>
                        {value === preset.key && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Helper to get preset label
export function getPresetLabel(key: string): string {
    return PRODUCT_PRESETS.find(p => p.key === key)?.label || "Brugerdefineret";
}

