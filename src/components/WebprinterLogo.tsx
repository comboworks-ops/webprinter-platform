import { Layers } from "lucide-react";

interface WebprinterLogoProps {
    className?: string;
    iconClassName?: string;
    textClassName?: string;
}

export const WebprinterLogo = ({ className = "", iconClassName = "w-8 h-8", textClassName = "text-xl" }: WebprinterLogoProps) => (
    <div className={`flex items-center gap-2 ${className}`}>
        <div className={`relative flex items-center justify-center rounded-lg bg-primary/10 text-primary ${iconClassName}`}>
            <Layers className="w-3/5 h-3/5" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
        </div>
        <span className={`font-heading font-bold tracking-tight ${textClassName}`}>
            Webprinter<span className="text-primary">.dk</span>
        </span>
    </div>
);
