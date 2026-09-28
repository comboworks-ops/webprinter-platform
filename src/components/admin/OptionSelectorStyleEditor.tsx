import type { ComponentProps, ReactNode } from "react";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { isPictureUiMode } from "@/lib/pricing/selectorStyling";
import {
    DEFAULT_PICTURE_BUTTON_STYLING,
    DEFAULT_TEXT_BUTTON_STYLING,
    DEFAULT_SELECTOR_BOX_STYLING,
    type PictureButtonStyling,
    type SelectorStyling,
    type TextButtonStyling,
} from "@/types/pricingStructure";

type OptionSelectorStyleEditorProps = {
    className?: string;
    hideIntro?: boolean;
    detachedLabels?: boolean;
    uiMode?: string;
    value?: SelectorStyling;
    onChange: (value: SelectorStyling, reset?: boolean) => void;
};

const colorHelp: Record<string, string> = {
    Baggrund: 'Grundfarven, før kunden vælger feltet.',
    'Hover baggrund': 'Baggrund når musen er over knappen.',
    Tekst: 'Tekstfarven i det normale felt.',
    'Hover tekst': 'Tekstfarven når musen er over knappen.',
    'Valgt baggrund': 'Baggrund på kundens aktive valg.',
    'Valgt tekst': 'Tekstfarven på kundens aktive valg.',
    Kant: 'Rammen rundt om feltet.',
    'Hover kant': 'Rammen når musen er over feltet.',
    'Valgt kant': 'Rammen på kundens aktive valg.',
    'Ring farve': 'Markeringen uden om det valgte felt.',
};
function StyleColorField(props: ComponentProps<typeof ColorPickerWithSwatches>) {
    return <div className="flex min-w-0 items-center gap-3" role="group" aria-label={props.label}>
        <ColorPickerWithSwatches {...props} />
        <div className="min-w-0"><p className="text-xs font-medium">{props.label}</p>
        {props.label && colorHelp[props.label] && <p className="text-[11px] leading-relaxed text-muted-foreground">{colorHelp[props.label]}</p>}</div>
    </div>;
}

const savedSwatches: string[] = [];

function ColorHelpField({
    help,
    children,
}: {
    help: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1">
            <div className="min-w-0">{children}</div>
            <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                {help}
            </p>
        </div>
    );
}

export function OptionSelectorStyleEditor({
    className,
    hideIntro = false,
    detachedLabels = false,
    uiMode,
    value,
    onChange,
}: OptionSelectorStyleEditorProps) {
    const pictureMode = isPictureUiMode(uiMode) || uiMode === "image_only" || uiMode === "text_below_image";
    const showButtonControls = uiMode === "buttons" || uiMode === "text_only";
    const showPictureControls = pictureMode;
    const showNote = uiMode === "dropdown" || uiMode === "checkboxes" || uiMode === "hidden";

    const textButtons = {
        ...DEFAULT_TEXT_BUTTON_STYLING,
        ...(value?.textButtons || {}),
    };

    const pictureButtons = {
        ...DEFAULT_PICTURE_BUTTON_STYLING,
        ...(value?.pictureButtons || {}),
    };

    const updateTextButton = <K extends keyof TextButtonStyling>(key: K, nextValue: TextButtonStyling[K]) => {
        onChange({
            ...(value || {}),
            textButtons: {
                ...(value?.textButtons || {}),
                [key]: nextValue,
            },
        });
    };

    const updatePictureButton = <K extends keyof PictureButtonStyling>(key: K, nextValue: PictureButtonStyling[K]) => {
        onChange({
            ...(value || {}),
            pictureButtons: {
                ...(value?.pictureButtons || {}),
                [key]: nextValue,
            },
        });
    };

    return (
        <div className={cn("max-w-full space-y-3 overflow-hidden rounded-md border bg-muted/20 p-2.5", className)}>
            <button type="button" className="text-xs font-medium underline underline-offset-4" onClick={() => onChange({ textButtons: { ...DEFAULT_TEXT_BUTTON_STYLING }, pictureButtons: { ...DEFAULT_PICTURE_BUTTON_STYLING, labelOutsideImage: true }, selectorBox: { ...DEFAULT_SELECTOR_BOX_STYLING } }, true)}>Gendan standardudseende</button>
            {!hideIntro && (
                <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Udseende</div>
                    <p className="text-[11px] text-muted-foreground">
                        Indstillingerne her gaelder kun denne sektion og overstyrer produktets generelle valgknapper.
                    </p>
                </div>
            )}

            <details className="rounded-md border p-2"><summary className="cursor-pointer text-xs font-medium">Sektionsboks — området omkring alle valg</summary><div className="mt-3 space-y-3">
                {(['backgroundColor', 'borderColor'] as const).map(key => <StyleColorField key={key} compact label={key === 'backgroundColor' ? 'Sektionsbaggrund' : 'Sektionskant'} value={{ ...DEFAULT_SELECTOR_BOX_STYLING, ...value?.selectorBox }[key]} onChange={color => onChange({ ...value, selectorBox: { ...value?.selectorBox, [key]: color } })} />)}
                {([['borderRadiusPx', 'Boksens hjørnerunding', 36], ['borderWidthPx', 'Boksens kantbredde', 6], ['paddingPx', 'Luft i sektionsboksen', 40]] as const).map(([key, label, max]) => <label key={key} className="block text-xs">{label} · {{ ...DEFAULT_SELECTOR_BOX_STYLING, ...value?.selectorBox }[key]} px<input className="mt-2 w-full" type="range" aria-label={label} min="0" max={max} step="1" value={{ ...DEFAULT_SELECTOR_BOX_STYLING, ...value?.selectorBox }[key]} onChange={event => onChange({ ...value, selectorBox: { ...value?.selectorBox, [key]: Number(event.target.value) } })} /></label>)}
            </div></details>

            {showNote && (
                <div className="rounded-md border bg-background/80 px-3 py-2 text-[11px] text-muted-foreground">
                    {uiMode === "dropdown" && "Dropdown bruger systemets normale select-stil. Skift til Knapper eller Foto for at style sektionen visuelt."}
                    {uiMode === "checkboxes" && "Checkbox-visning bruger standard checkbox-layout lige nu. Skift til Knapper eller Foto for at style sektionen visuelt."}
                    {uiMode === "hidden" && "Sektionen er skjult, saa udseendet bruges ikke paa storefronten."}
                </div>
            )}

            {showButtonControls && (
                <div className="space-y-4">
                    <div className="text-xs font-medium">Knapper</div>
                    <div className="grid gap-3">
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Baggrund"
                            value={textButtons.backgroundColor}
                            onChange={(color) => updateTextButton("backgroundColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Hover baggrund"
                            value={textButtons.hoverBackgroundColor}
                            onChange={(color) => updateTextButton("hoverBackgroundColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Tekst"
                            value={textButtons.textColor}
                            onChange={(color) => updateTextButton("textColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Hover tekst"
                            value={textButtons.hoverTextColor}
                            onChange={(color) => updateTextButton("hoverTextColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Valgt baggrund"
                            value={textButtons.selectedBackgroundColor}
                            onChange={(color) => updateTextButton("selectedBackgroundColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Valgt tekst"
                            value={textButtons.selectedTextColor}
                            onChange={(color) => updateTextButton("selectedTextColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Kant"
                            value={textButtons.borderColor}
                            onChange={(color) => updateTextButton("borderColor", color)}
                        />
                        <StyleColorField
                            compact
                            showFullSwatches={false}
                            savedSwatches={savedSwatches}
                            label="Hover kant"
                            value={textButtons.hoverBorderColor}
                            onChange={(color) => updateTextButton("hoverBorderColor", color)}
                        />
                    </div>

                    <Separator />

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Hjørnerunding</Label>
                                <span className="text-[11px] text-muted-foreground">{textButtons.borderRadiusPx}px</span>
                            </div>
                            <Slider aria-label="Hjørnerunding"
                                min={0}
                                max={36}
                                step={1}
                                value={[textButtons.borderRadiusPx]}
                                onValueChange={([nextValue]) => updateTextButton("borderRadiusPx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Kantbredde</Label>
                                <span className="text-[11px] text-muted-foreground">{textButtons.borderWidthPx}px</span>
                            </div>
                            <Slider aria-label="Kantbredde"
                                min={0}
                                max={6}
                                step={1}
                                value={[textButtons.borderWidthPx]}
                                onValueChange={([nextValue]) => updateTextButton("borderWidthPx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Tekststørrelse</Label>
                                <span className="text-[11px] text-muted-foreground">{textButtons.fontSizePx}px</span>
                            </div>
                            <Slider aria-label="Tekststørrelse"
                                min={10}
                                max={22}
                                step={1}
                                value={[textButtons.fontSizePx]}
                                onValueChange={([nextValue]) => updateTextButton("fontSizePx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Knaphøjde</Label>
                                <span className="text-[11px] text-muted-foreground">{textButtons.minHeightPx}px</span>
                            </div>
                            <Slider aria-label="Knaphøjde"
                                min={28}
                                max={72}
                                step={2}
                                value={[textButtons.minHeightPx]}
                                onValueChange={([nextValue]) => updateTextButton("minHeightPx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Padding</Label>
                                <span className="text-[11px] text-muted-foreground">{textButtons.paddingPx}px</span>
                            </div>
                            <Slider aria-label="Padding"
                                min={4}
                                max={24}
                                step={1}
                                value={[textButtons.paddingPx]}
                                onValueChange={([nextValue]) => updateTextButton("paddingPx", nextValue)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {showPictureControls && (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="text-xs font-medium">Foto-valg</div>
                        <p className="text-[11px] text-muted-foreground">
                            Vælg billedstørrelse med skyderen ovenfor. Navnet vises uden for billedet. Manglende billeder vises som en pladsholder.
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                        <div>
                            <div className="text-xs font-medium">Ingen baggrund</div>
                            <div className="text-[11px] text-muted-foreground">Brug gennemsigtig baggrund bag transparente PNG-valg.</div>
                        </div>
                        <Switch
                            checked={pictureButtons.transparentBackground === true}
                            onCheckedChange={(checked) => updatePictureButton("transparentBackground", checked)}
                        />
                    </div>

                    {!detachedLabels && <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                        <div>
                            <div className="text-xs font-medium">Tekst udenfor billede</div>
                            <div className="text-[11px] text-muted-foreground">Vis navnet under billedfeltet i stedet for inde i selve billedboksen.</div>
                        </div>
                        <Switch
                            checked={pictureButtons.labelOutsideImage === true}
                            onCheckedChange={(checked) => updatePictureButton("labelOutsideImage", checked)}
                        />
                    </div>}

                    <div className="grid gap-3">
                        {!pictureButtons.transparentBackground && (
                            <ColorHelpField help="Fladen bag selve billedet eller placeholderen.">
                                <StyleColorField
                                    compact
                                    showFullSwatches={false}
                                    savedSwatches={savedSwatches}
                                    label="Baggrund"
                                    value={pictureButtons.backgroundColor}
                                    onChange={(color) => updatePictureButton("backgroundColor", color)}
                                />
                            </ColorHelpField>
                        )}
                        <ColorHelpField help="Navnet paa valget under eller ved billedet.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Tekst"
                                value={pictureButtons.textColor}
                                onChange={(color) => updatePictureButton("textColor", color)}
                            />
                        </ColorHelpField>
                        <ColorHelpField help="Den normale ramme rundt om feltet.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Kant"
                                value={pictureButtons.borderColor}
                                onChange={(color) => updatePictureButton("borderColor", color)}
                            />
                        </ColorHelpField>
                        <ColorHelpField help="Kanten naar feltet bliver holdt over.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Hover kant"
                                value={pictureButtons.hoverBorderColor}
                                onChange={(color) => updatePictureButton("hoverBorderColor", color)}
                            />
                        </ColorHelpField>
                        <ColorHelpField help="Kanten paa det aktive eller valgte felt.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Valgt kant"
                                value={pictureButtons.selectedBorderColor}
                                onChange={(color) => updatePictureButton("selectedBorderColor", color)}
                            />
                        </ColorHelpField>
                        <ColorHelpField help="Den ydre ring naar valgt-effekt er sat til Ring.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Ringfarve"
                                value={pictureButtons.selectedRingColor}
                                onChange={(color) => updatePictureButton("selectedRingColor", color)}
                            />
                        </ColorHelpField>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Tekststørrelse</Label>
                                <span className="text-[11px] text-muted-foreground">{pictureButtons.labelFontSizePx}px</span>
                            </div>
                            <Slider
                                min={9}
                                max={24}
                                step={1}
                                value={[pictureButtons.labelFontSizePx]}
                                onValueChange={([nextValue]) => updatePictureButton("labelFontSizePx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Hover-effekt</Label>
                            <Select
                                value={pictureButtons.hoverEffect}
                                onValueChange={(nextValue) => updatePictureButton("hoverEffect", nextValue as PictureButtonStyling["hoverEffect"])}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fill">Farve</SelectItem>
                                    <SelectItem value="outline">Outline</SelectItem>
                                    <SelectItem value="none">Ingen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Valgt-effekt</Label>
                            <Select
                                value={pictureButtons.selectedEffect}
                                onValueChange={(nextValue) => updatePictureButton("selectedEffect", nextValue as PictureButtonStyling["selectedEffect"])}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fill">Farve</SelectItem>
                                    <SelectItem value="outline">Outline</SelectItem>
                                    <SelectItem value="ring">Ring</SelectItem>
                                    <SelectItem value="none">Ingen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <ColorHelpField help="Overlay eller fyld ved hover-effekt = Farve.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Hover farve"
                                value={pictureButtons.hoverColor}
                                onChange={(color) => updatePictureButton("hoverColor", color)}
                            />
                        </ColorHelpField>
                        <ColorHelpField help="Overlay eller fyld ved valgt-effekt = Farve.">
                            <StyleColorField
                                compact
                                showFullSwatches={false}
                                savedSwatches={savedSwatches}
                                label="Valgt farve"
                                value={pictureButtons.selectedColor}
                                onChange={(color) => updatePictureButton("selectedColor", color)}
                            />
                        </ColorHelpField>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Hover opacitet</Label>
                                <span className="text-[11px] text-muted-foreground">{Math.round(pictureButtons.hoverOpacity * 100)}%</span>
                            </div>
                            <Slider
                                min={0}
                                max={100}
                                step={5}
                                value={[Math.round(pictureButtons.hoverOpacity * 100)]}
                                onValueChange={([nextValue]) => updatePictureButton("hoverOpacity", nextValue / 100)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Valgt opacitet</Label>
                                <span className="text-[11px] text-muted-foreground">{Math.round(pictureButtons.selectedOpacity * 100)}%</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Paavirker valgt farve og ring-effekten. Outline bruger kantens egen opacitet.
                            </p>
                            <Slider
                                min={0}
                                max={100}
                                step={5}
                                value={[Math.round(pictureButtons.selectedOpacity * 100)]}
                                onValueChange={([nextValue]) => updatePictureButton("selectedOpacity", nextValue / 100)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Hjørnerunding</Label>
                                <span className="text-[11px] text-muted-foreground">{pictureButtons.imageBorderRadiusPx}px</span>
                            </div>
                            <Slider
                                min={0}
                                max={32}
                                step={1}
                                value={[pictureButtons.imageBorderRadiusPx]}
                                onValueChange={([nextValue]) => updatePictureButton("imageBorderRadiusPx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Kantbredde</Label>
                                <span className="text-[11px] text-muted-foreground">{pictureButtons.borderWidthPx}px</span>
                            </div>
                            <Slider
                                min={0}
                                max={6}
                                step={1}
                                value={[pictureButtons.borderWidthPx]}
                                onValueChange={([nextValue]) => updatePictureButton("borderWidthPx", nextValue)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Afstand mellem valg</Label>
                                <span className="text-[11px] text-muted-foreground">{pictureButtons.gapBetweenPx}px</span>
                            </div>
                            <Slider
                                min={0}
                                max={24}
                                step={1}
                                value={[pictureButtons.gapBetweenPx]}
                                onValueChange={([nextValue]) => updatePictureButton("gapBetweenPx", nextValue)}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between rounded-md border bg-background/80 px-3 py-2">
                        <div>
                            <div className="text-xs font-medium">Zoom ved hover</div>
                            <div className="text-[11px] text-muted-foreground">Tilfoej en lille bevaegelse paa billedevalg.</div>
                        </div>
                        <Switch
                            checked={pictureButtons.hoverZoomEnabled}
                            onCheckedChange={(checked) => updatePictureButton("hoverZoomEnabled", checked)}
                        />
                    </div>

                    {pictureButtons.hoverZoomEnabled && (
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Zoom-styrke</Label>
                                    <span className="text-[11px] text-muted-foreground">{pictureButtons.hoverZoomScale.toFixed(2)}x</span>
                                </div>
                                <Slider
                                    min={100}
                                    max={120}
                                    step={1}
                                    value={[Math.round(pictureButtons.hoverZoomScale * 100)]}
                                    onValueChange={([nextValue]) => updatePictureButton("hoverZoomScale", nextValue / 100)}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Animation</Label>
                                    <span className="text-[11px] text-muted-foreground">{pictureButtons.hoverZoomDurationMs}ms</span>
                                </div>
                                <Slider
                                    min={60}
                                    max={320}
                                    step={10}
                                    value={[pictureButtons.hoverZoomDurationMs]}
                                    onValueChange={([nextValue]) => updatePictureButton("hoverZoomDurationMs", nextValue)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
