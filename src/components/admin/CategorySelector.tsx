
import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface CategorySelectorProps {
    value: string
    onValueChange: (value: string) => void
    existingCategories: string[]
    placeholder?: string
}

export function CategorySelector({
    value,
    onValueChange,
    existingCategories,
    placeholder = "Vælg kategori..."
}: CategorySelectorProps) {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")

    // Filter categories based on input if needed, or just rely on Command's internal filtering.
    // We want to show the "Create" option if the input doesn't match any existing category.

    const filteredCategories = useMemo(() => {
        return existingCategories.sort();
    }, [existingCategories]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value ? value : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Søg kategori..."
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <div className="p-2">
                                <p className="text-sm text-muted-foreground mb-2">Ingen kategori fundet.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        onValueChange(inputValue);
                                        setOpen(false);
                                        setInputValue("");
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Opret "{inputValue}"
                                </Button>
                            </div>
                        </CommandEmpty>
                        <CommandGroup heading="Eksisterende kategorier">
                            {filteredCategories.map((category) => (
                                <CommandItem
                                    key={category}
                                    value={category}
                                    onSelect={(currentValue) => {
                                        // currentValue from command is lowercased, so we use the actual category name
                                        onValueChange(category)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === category ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {category}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
