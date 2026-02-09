import * as React from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxTags?: number;
}

export function TagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "Tilf\u00f8j tag...",
  disabled = false,
  className,
  maxTags,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter suggestions to exclude already selected tags
  const availableSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if we can add more tags
  const canAddMore = !maxTags || value.length < maxTags;

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;
    if (value.includes(trimmedTag)) return;
    if (!canAddMore) return;

    onChange([...value, trimmedTag]);
    setInputValue("");
    setOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Display existing tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 rounded-full outline-none hover:bg-secondary-foreground/20 focus:ring-2 focus:ring-ring"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Fjern {tag}</span>
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Add tag input with autocomplete */}
      {canAddMore && !disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (e.target.value && !open) {
                    setOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="pr-8"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                onClick={() => inputValue.trim() && addTag(inputValue)}
                disabled={!inputValue.trim()}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Tilf\u00f8j tag</span>
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                {inputValue.trim() && !suggestions.includes(inputValue.trim()) && (
                  <CommandGroup heading="Opret nyt tag">
                    <CommandItem
                      onSelect={() => addTag(inputValue)}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Opret "{inputValue.trim()}"
                    </CommandItem>
                  </CommandGroup>
                )}
                {availableSuggestions.length > 0 && (
                  <CommandGroup heading="Eksisterende tags">
                    {availableSuggestions.slice(0, 10).map((suggestion) => (
                      <CommandItem
                        key={suggestion}
                        onSelect={() => addTag(suggestion)}
                        className="cursor-pointer"
                      >
                        {suggestion}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!inputValue.trim() && availableSuggestions.length === 0 && (
                  <CommandEmpty>
                    Skriv for at oprette et nyt tag
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
