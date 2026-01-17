"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, FileText, Settings2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TemplateManagementModal } from "./TemplateManagementModal";
import type { JobDescriptionTemplate } from "./JobDescriptionField";

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateSelectorProps {
  /** Available templates */
  templates: JobDescriptionTemplate[];
  /** Currently selected template ID */
  selectedTemplateId?: string;
  /** Callback when template is selected */
  onSelect: (template: JobDescriptionTemplate) => void;
  /** Callback when template is permanently deleted */
  onDelete?: (id: string) => Promise<{ success: boolean; clearedReferences: number }>;
  /** Callback when template is updated */
  onUpdate?: (id: string, name: string, description: string) => Promise<void>;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TemplateSelector Component
 *
 * Dropdown for selecting job description templates.
 * Features:
 * - Search/filter templates by position title
 * - Shows usage count for each template
 * - Access to template management modal
 * - Sorts templates alphabetically
 *
 * @example
 * ```tsx
 * <TemplateSelector
 *   templates={templates}
 *   selectedTemplateId={loadedTemplateId}
 *   onSelect={handleLoadTemplate}
 * />
 * ```
 */
export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  onDelete,
  onUpdate,
  disabled = false,
  className,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  // Sort templates alphabetically by name
  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );

  const handleSelect = (template: JobDescriptionTemplate) => {
    onSelect(template);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select template"
            disabled={disabled}
            className={cn(
              "justify-between gap-2 border-2 min-w-[140px] sm:min-w-[180px] min-h-[44px]",
              !selectedTemplate && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate text-sm">
                {selectedTemplate ? selectedTemplate.name : "Load Template..."}
              </span>
            </div>
            <ChevronsUpDown className="h-5 w-5 sm:h-4 sm:w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[300px] p-0 border-2" align="start">
          <Command>
            <CommandInput placeholder="Search templates..." />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No templates found</p>
                  <p className="text-xs text-muted-foreground">
                    Create one by filling in the description below
                  </p>
                </div>
              </CommandEmpty>
              {sortedTemplates.length > 0 && (
                <CommandGroup heading="Templates">
                  {sortedTemplates.map((template) => (
                    <CommandItem
                      key={template._id}
                      value={template.name}
                      onSelect={() => handleSelect(template)}
                      className="flex items-center justify-between gap-2 min-h-[44px] py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn(
                            "h-5 w-5 sm:h-4 sm:w-4 shrink-0",
                            selectedTemplateId === template._id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate text-sm">{template.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {template.usageCount > 0 && `Used ${template.usageCount}×`}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setManagementOpen(true);
                  }}
                  className="gap-2 min-h-[44px] py-2"
                >
                  <Settings2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  <span>Manage Templates...</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Template Management Modal */}
      <TemplateManagementModal
        open={managementOpen}
        onOpenChange={setManagementOpen}
        templates={templates}
        onSelect={(template) => {
          handleSelect(template);
          setManagementOpen(false);
        }}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    </>
  );
}

export default TemplateSelector;
