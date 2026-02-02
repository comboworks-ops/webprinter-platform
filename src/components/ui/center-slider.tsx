import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const CenterSlider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, min = -100, max = 100, ...props }, ref) => {
    // Access value to determine fill width/position
    const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0;

    // Calculate percentage positions
    // Formula: (value - min) / (max - min) * 100
    const range = max - min;
    const zeroPos = ((0 - min) / range) * 100;
    const valuePos = ((value - min) / range) * 100;

    // Determine left and width for the fill bar
    const left = Math.min(zeroPos, valuePos);
    const width = Math.abs(valuePos - zeroPos);

    return (
        <SliderPrimitive.Root
            ref={ref}
            min={min}
            max={max}
            className={cn("relative flex w-full touch-none select-none items-center", className)}
            {...props}
        >
            <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
                {/* Custom fill bar starting from 0 */}
                <div
                    className="absolute h-full bg-primary"
                    style={{
                        left: `${left}%`,
                        width: `${width}%`
                    }}
                />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
    )
})
CenterSlider.displayName = SliderPrimitive.Root.displayName

export { CenterSlider }
