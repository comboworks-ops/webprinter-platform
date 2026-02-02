import { cn } from "@/lib/utils";
import { Calculator, LayoutGrid, Cpu, FileSpreadsheet, Ruler, Info } from "lucide-react";

// Pricing method definitions with explanations
export const PRICING_METHODS = [
    {
        key: "matrix",
        label: "Matrix",
        icon: LayoutGrid,
        description: "En manuel pristabel hvor du opretter rækker med varianter, antal og pris. Hver kombination får sin egen pris, som du kan redigere direkte.",
        example: "100 stk: 299 kr, 250 stk: 399 kr, 500 stk: 549 kr",
        bestFor: "Bedst til enkle produkter med faste priser baseret på antal og varianter.",
    },
    {
        key: "rate",
        label: "M2 Takst",
        icon: FileSpreadsheet,
        description: "Prisen beregnes per kvadratmeter baseret på materiale og arealintervaller. Du opretter takster for forskellige materialer med pris per m2.",
        example: "Forex 0-1 m2: 350 kr/m2, 1-5 m2: 299 kr/m2",
        bestFor: "Bedst til storformat og skilte hvor prisen afhænger af størrelse og materiale.",
    },
    {
        key: "formula",
        label: "Formel",
        icon: Calculator,
        description: "Prisen beregnes automatisk ud fra en formel med startpris og pris per enhed. Systemet udregner totalprisen baseret på antal.",
        example: "Startpris 50 kr + 2 kr pr stk = 100 stk koster 250 kr",
        bestFor: "Bedst til produkter hvor prisen skalerer lineært med antal.",
    },
    {
        key: "calculator",
        label: "Lommeregner",
        icon: Ruler,
        description: "Frit format hvor kunden selv indtaster mål og antal. Prisen beregnes dynamisk baseret på de indtastede værdier og en konfigureret formel.",
        example: "Bredde x Højde x Pris/m2 + Startomkostninger",
        bestFor: "Bedst til produkter med frie mål hvor kunden selv angiver dimensioner.",
    },
    {
        key: "fixed",
        label: "Fast Pris",
        icon: LayoutGrid,
        description: "En fast pris for produktet uanset antal eller varianter. Simpel prissætning hvor alle kunder betaler samme pris.",
        example: "Produkt: 299 kr (uanset antal)",
        bestFor: "Bedst til enkle produkter med én fast pris uden variationer.",
    },
    {
        key: "machine-priced",
        label: "Maskinberegning",
        icon: Cpu,
        description: "Avanceret prisberegning baseret på maskinomkostninger, materialer, blæk, efterbehandling og avance. Prisen beregnes ud fra faktiske produktionsomkostninger.",
        example: "Papir + blæk + maskintid + efterbehandling + avance",
        bestFor: "Bedst til komplekse produkter med mange variabler og omkostningsbaseret prissætning.",
    },
] as const;

export type PricingMethodKey = typeof PRICING_METHODS[number]["key"];

interface PricingMethodSelectorProps {
    value: string;
    onChange: (key: PricingMethodKey) => void;
    disabled?: boolean;
}

export function PricingMethodSelector({ value, onChange, disabled }: PricingMethodSelectorProps) {
    const selectedMethod = PRICING_METHODS.find(m => m.key === value) || PRICING_METHODS[0];

    return (
        <div className="space-y-4">
            {/* Method Buttons - 3 columns, 2 rows */}
            <div className="grid grid-cols-3 gap-3">
                {PRICING_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = value === method.key;

                    return (
                        <button
                            key={method.key}
                            type="button"
                            onClick={() => !disabled && onChange(method.key)}
                            disabled={disabled}
                            className={cn(
                                "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center",
                                "hover:border-primary/50 hover:bg-primary/5",
                                isSelected
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                                    : "border-border bg-card",
                                disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Icon className={cn(
                                "h-6 w-6",
                                isSelected ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className={cn(
                                "text-sm font-medium",
                                isSelected && "text-primary"
                            )}>
                                {method.label}
                            </span>
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Explanation Panel */}
            <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                        <div>
                            <h4 className="font-medium text-sm">{selectedMethod.label}</h4>
                            <p className="text-sm text-muted-foreground">{selectedMethod.description}</p>
                        </div>

                        <div className="bg-background border rounded-md px-3 py-2">
                            <p className="text-xs text-muted-foreground mb-1">Eksempel:</p>
                            <p className="text-sm font-mono">{selectedMethod.example}</p>
                        </div>

                        <p className="text-xs text-muted-foreground italic">{selectedMethod.bestFor}</p>
                    </div>
                </div>
            </div>

            {/* Matrix Clarification Note */}
            <p className="text-xs text-muted-foreground">
                Bemærk: Priser kan vises som tabel (matrix), uanset hvilken beregningsmetode der bruges.
            </p>
        </div>
    );
}

// Helper to get method label
export function getPricingMethodLabel(key: string): string {
    return PRICING_METHODS.find(m => m.key === key)?.label || "Matrix";
}
