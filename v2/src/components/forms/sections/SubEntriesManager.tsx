"use client";

import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon as Trash2 } from "@phosphor-icons/react";
import type { SubEntry } from "@/lib/shared/types";
import type { DateConstraint } from "@/lib/forms/date-constraints";

interface SubEntriesManagerProps {
  entries: SubEntry[];
  onChange: (entries: SubEntry[]) => void;
  dateConstraint?: DateConstraint;
  maxEntries?: number; // default 10
  methodLabel: string; // e.g., "Radio Ad" for display
  required?: boolean; // show required indicator on date fields
  errors?: Record<string, string>; // validation errors keyed by field path
  methodIndex?: number; // parent method index for error path lookup
}

export function SubEntriesManager({
  entries,
  onChange,
  dateConstraint,
  maxEntries = 10,
  methodLabel,
  required,
  errors,
  methodIndex,
}: SubEntriesManagerProps) {
  const addEntry = () => {
    if (entries.length < maxEntries) {
      onChange([...entries, { date: '', description: '' }]);
    }
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof SubEntry, value: string) => {
    onChange(entries.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {methodLabel} Entries ({entries.length})
        </span>
      </div>

      {dateConstraint?.hint && (
        <p className="text-xs text-muted-foreground">
          {dateConstraint.hint}
        </p>
      )}

      {entries.map((entry, index) => {
        const dateErrorKey = methodIndex !== undefined
          ? `additionalRecruitmentMethods.${methodIndex}.subEntries.${index}.date`
          : undefined;
        const dateError = dateErrorKey ? errors?.[dateErrorKey] : undefined;

        return (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1 grid [&>*]:min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
            <FormField
              label={`Date ${index + 1}`}
              name={`sub-entry-date-${index}`}
              required={required}
              error={dateError}
            >
              <DateInput
                id={`sub-entry-date-${index}`}
                name={`sub-entry-date-${index}`}
                value={entry.date || ''}
                onChange={(e) => updateEntry(index, 'date', e.target.value)}
                minDate={dateConstraint?.min}
                maxDate={dateConstraint?.max}
                error={!!dateError}
              />
            </FormField>
            <FormField
              label={`Description ${index + 1}`}
              name={`sub-entry-desc-${index}`}
              hint="e.g., station name, time slot"
            >
              <Input
                id={`sub-entry-desc-${index}`}
                value={entry.description || ''}
                onChange={(e) => updateEntry(index, 'description', e.target.value)}
                placeholder="e.g., WABC morning show"
                maxLength={500}
              />
            </FormField>
          </div>
          {entries.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(index)}
              aria-label={`Remove entry ${index + 1}`}
              className="h-8 w-8 p-0 mt-6 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        );
      })}

      {entries.length < maxEntries && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      )}
    </div>
  );
}
