"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Generic interface for combobox items
export interface ComboboxItem {
  id: string | number;
  label: string;
  value: string;
  subtitle?: string;
  disabled?: boolean;
}

// Props for the generic combobox
interface GenericComboboxProps<T extends ComboboxItem> {
  items: T[];
  selectedItem?: T | null;
  onSelect: (item: T | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  width?: string;
  popoverWidth?: string;
  allowClear?: boolean;
  clearLabel?: string;
  showSearch?: boolean;
  showSubtitle?: boolean;
  variant?:
    | "outline"
    | "default"
    | "destructive"
    | "secondary"
    | "ghost"
    | "link";
}

export function GenericCombobox<T extends ComboboxItem>({
  items,
  selectedItem,
  onSelect,
  placeholder = "Select an item...",
  searchPlaceholder = "Search items...",
  emptyMessage = "No items found.",
  disabled = false,
  className = "",
  width,
  popoverWidth,
  allowClear = false,
  clearLabel = "No selection",
  showSearch = true,
  showSubtitle = false,
  variant = "outline",
}: GenericComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSelect = (value: string) => {
    if (allowClear && value === "clear") {
      onSelect(null);
    } else {
      const item = items.find((item) => item.value === value);
      onSelect(item || null);
    }
    setOpen(false);
  };

  const buttonContent = (
    <>
      {selectedItem ? (
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {showSearch && (
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="truncate">{selectedItem.label}</span>
        </span>
      ) : (
        <span className="text-muted-foreground flex items-center gap-2 min-w-0 flex-1">
          {showSearch && <Search className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate">{placeholder}</span>
        </span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </>
  );

  const listContent = (
    <ItemList
      items={items}
      selectedItem={selectedItem}
      onSelect={handleSelect}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      allowClear={allowClear}
      clearLabel={clearLabel}
      showSubtitle={showSubtitle}
    />
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            role="combobox"
            aria-expanded={open}
            className={`${width} justify-between ${className}`}
            disabled={disabled}
          >
            {buttonContent}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          {listContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant={variant}
          role="combobox"
          aria-expanded={open}
          className={`${width} justify-between ${className}`}
          disabled={disabled}
        >
          {buttonContent}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[60vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle className="text-left">
            {searchPlaceholder || "Select an option"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">{listContent}</div>
      </DrawerContent>
    </Drawer>
  );
}

interface ItemListProps<T extends ComboboxItem> {
  items: T[];
  selectedItem?: T | null;
  onSelect: (value: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  allowClear: boolean;
  clearLabel: string;
  showSubtitle: boolean;
}

function ItemList<T extends ComboboxItem>({
  items,
  selectedItem,
  onSelect,
  searchPlaceholder,
  emptyMessage,
  allowClear,
  clearLabel,
  showSubtitle,
}: ItemListProps<T>) {
  return (
    <Command>
      <CommandInput placeholder={searchPlaceholder} className="h-9" />
      <CommandList className={`max-h-[50vh] md:max-h-[200px] overflow-y-auto`}>
        {" "}
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {allowClear && (
            <CommandItem
              value="clear"
              onSelect={onSelect}
              className="cursor-pointer"
            >
              <Check
                className={`mr-2 h-4 w-4 flex-shrink-0 ${
                  !selectedItem ? "opacity-100" : "opacity-0"
                }`}
              />
              <span className="text-muted-foreground truncate min-w-0">
                {clearLabel}
              </span>
            </CommandItem>
          )}
          {items.map((item) => (
            <CommandItem
              key={item.id}
              value={item.value}
              onSelect={onSelect}
              disabled={item.disabled}
              className="cursor-pointer min-w-0"
            >
              <Check
                className={`mr-2 h-4 w-4 flex-shrink-0 ${
                  selectedItem?.id === item.id ? "opacity-100" : "opacity-0"
                }`}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate min-w-0">
                  {item.label}
                </span>
                {showSubtitle && item.subtitle && (
                  <span className="text-sm text-muted-foreground truncate min-w-0">
                    {item.subtitle}
                  </span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// Helper function to transform your existing data into ComboboxItem format
export function createComboboxItem(
  id: string | number,
  label: string,
  value?: string,
  subtitle?: string,
  disabled?: boolean,
): ComboboxItem {
  return {
    id,
    label,
    value: value || String(id),
    subtitle,
    disabled,
  };
}
