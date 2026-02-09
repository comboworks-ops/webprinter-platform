import {
    Award,
    BadgeCheck,
    HeartHandshake,
    Phone,
    Rocket,
    ShieldCheck,
    Sparkles,
    Star,
    ThumbsUp,
    Truck,
} from "lucide-react";

export const BANNER2_ICON_MAP = {
    Truck,
    Award,
    Phone,
    Star,
    ShieldCheck,
    Sparkles,
    Rocket,
    ThumbsUp,
    BadgeCheck,
    HeartHandshake,
};

export type Banner2IconName = keyof typeof BANNER2_ICON_MAP;

export const BANNER2_ICON_OPTIONS: { value: Banner2IconName; label: string }[] = [
    { value: "Truck", label: "Levering" },
    { value: "Award", label: "Kvalitet" },
    { value: "Phone", label: "Support" },
    { value: "Star", label: "Stjerne" },
    { value: "ShieldCheck", label: "Sikkerhed" },
    { value: "Sparkles", label: "Eksklusiv" },
    { value: "Rocket", label: "Hurtig" },
    { value: "ThumbsUp", label: "Anbefalet" },
    { value: "BadgeCheck", label: "Verificeret" },
    { value: "HeartHandshake", label: "Partnerskab" },
];
