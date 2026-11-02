"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowsClockwiseIcon, CheckIcon, CircleNotchIcon, CopyIcon, TrashIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { CharLimit } from "@/components/ui/char-limit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useJobDescriptionTemplates, type JobDescriptionTemplate } from "@/hooks/useJobDescriptionTemplates";
import { INPUT_LIMITS } from "@convex/lib/validation";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "@/lib/toast";
import { SocDescriptionSuggestion } from "./SocDescriptionSuggestion";
import { TemplateSelector } from "./TemplateSelector";
import { TemplateSaveButton, TemplateStatusBadge, TemplateTypeBadge, copyToClipboard, templateErrorMessage } from "./shared";

export interface JobDescriptionEditorProps {
  /** Prefix for the inputs' ids, unique on the page. */
  idPrefix: string;
  /** The case's position title, which the description's own title follows until it's edited. */
  inheritedPositionTitle: string;
  positionTitle: string;
  description: string;
  /** The case's SOC code: its O*NET description is offered as a starting point. */
  socCode?: string;
  /** The template the text was loaded from, if any. */
  templateId?: Id<"jobDescriptionTemplates">;
  onPositionTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTemplateChange: (id: Id<"jobDescriptionTemplates"> | undefined) => void;
  /** Shows a Clear button that empties the text here; the case page clears through its own save instead. */
  clearable?: boolean;
  disabled?: boolean;
}

/**
 * The one job description editor, used by the case form and the case page alike: the saved templates, the
 * description's own title (following the position title until it's edited), the text, the suggestion from
 * the case's SOC code, and saving the text as a template. It reads the templates itself
 * (`useJobDescriptionTemplates`), so its two frames pass only the case's values.
 */
export function JobDescriptionEditor({
  idPrefix,
  inheritedPositionTitle,
  positionTitle,
  description,
  socCode,
  templateId,
  onPositionTitleChange,
  onDescriptionChange,
  onTemplateChange,
  clearable = false,
  disabled = false,
}: JobDescriptionEditorProps) {
  const { templates, isLoading, loadTemplate, saveAsNewTemplate, updateTemplate, hardDeleteTemplate } = useJobDescriptionTemplates();
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ name: string; description: string } | null>(null);
  // The description's title follows the position title until it's typed over; the reset button resumes it.
  const [tracking, setTracking] = useState(!positionTitle || positionTitle === inheritedPositionTitle);
  // What the loaded template said, to mark the text as changed since.
  const [original, setOriginal] = useState<{ positionTitle: string; description: string } | null>(null);

  // While it follows, the box shows the case's title and nothing is written, so opening the editor never marks
  // the form changed. A stored copy of the old title moves with the case's title when that is edited.
  const shown = tracking ? inheritedPositionTitle : positionTitle;
  const lastInherited = useRef(inheritedPositionTitle);
  useEffect(() => {
    if (lastInherited.current === inheritedPositionTitle) return;
    lastInherited.current = inheritedPositionTitle;
    if (tracking && positionTitle) onPositionTitleChange(inheritedPositionTitle);
  }, [inheritedPositionTitle, tracking, positionTitle, onPositionTitleChange]);

  // Only the template picker and Save need the saved templates; the words, Copy, Clear and the suggestion work
  // while they load, and a line says they're loading (owner, Nov 2 2026: nothing greyed out in silence).
  const busy = disabled;
  const templatesBusy = disabled || isLoading;
  const loaded = templates.find((t) => t._id === templateId);
  const modified = Boolean(loaded && original && (shown !== original.positionTitle || description !== original.description));
  const name = shown.trim();
  const matching = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const canSave = Boolean(name && description.trim() && description.length <= INPUT_LIMITS.LONG);
  const hasContent = Boolean(name || description.trim());

  const handleLoad = useCallback(
    async (template: JobDescriptionTemplate) => {
      setTracking(false);
      onPositionTitleChange(template.name);
      onDescriptionChange(template.description);
      onTemplateChange(template._id);
      setOriginal({ positionTitle: template.name, description: template.description });
      toast.success(`Loaded template: ${template.name}`);
      await loadTemplate(template);
    },
    [onPositionTitleChange, onDescriptionChange, onTemplateChange, loadTemplate],
  );

  const handleCopy = useCallback(async () => {
    if (await copyToClipboard(description)) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [description]);

  const handleClear = useCallback(() => {
    onPositionTitleChange("");
    onDescriptionChange("");
    onTemplateChange(undefined);
    setOriginal(null);
    setTracking(true);
    toast.success("Job description cleared");
  }, [onPositionTitleChange, onDescriptionChange, onTemplateChange]);

  /** Saves the text as a template, or updates the one with its name; a name the server already holds asks first. */
  const save = useCallback(
    async (target: { name: string; description: string }, existing: JobDescriptionTemplate | undefined) => {
      setIsSaving(true);
      try {
        if (existing) {
          await updateTemplate(existing._id, target.name, target.description);
          toast.success(`Template "${target.name}" updated`);
        } else {
          const id = await saveAsNewTemplate(target.name, target.description);
          onTemplateChange(id);
          toast.success(`Template "${target.name}" saved`);
        }
        setOriginal({ positionTitle: target.name, description: target.description });
      } catch (error) {
        const message = templateErrorMessage(error);
        if (!existing && message.startsWith("TEMPLATE_EXISTS:")) setPendingUpdate(target);
        else toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [updateTemplate, saveAsNewTemplate, onTemplateChange],
  );

  const confirmPendingUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    const match = templates.find((t) => t.name.toLowerCase() === pendingUpdate.name.toLowerCase());
    setPendingUpdate(null);
    // The template may have gone in the meantime: then this saves a new one.
    await save(pendingUpdate, match);
  }, [pendingUpdate, templates, save]);

  const titleId = `${idPrefix}-position`;
  const textId = `${idPrefix}-description`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TemplateSelector
          templates={templates}
          selectedTemplateId={templateId}
          onSelect={(t) => void handleLoad(t)}
          onDelete={hardDeleteTemplate}
          onUpdate={updateTemplate}
          disabled={templatesBusy}
        />{" "}
        <Button type="button" variant="outline" onClick={() => void handleCopy()} disabled={!description || busy}>
          {isCopied ? <CheckIcon className="size-4 text-primary-text" aria-hidden="true" /> : <CopyIcon className="size-4" aria-hidden="true" />}
          Copy
        </Button>{" "}
        {clearable ? (
          <Button type="button" variant="outline" onClick={handleClear} disabled={!hasContent || busy} className="text-destructive-text">
            <TrashIcon className="size-4" aria-hidden="true" />
            Clear
          </Button>
        ) : null}{" "}
        {loaded ? <TemplateStatusBadge isModified={modified} /> : null}
        {isLoading ? (
          <span role="status" className="inline-flex items-center gap-2 text-sm text-soft">
            <CircleNotchIcon aria-hidden="true" weight="bold" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
            Loading your saved templates…
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={titleId}>Position title for the job description</Label>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CharLimit max={INPUT_LIMITS.SHORT}>
            <Input
              id={titleId}
              value={shown}
              onChange={(e) => {
                setTracking(false);
                onPositionTitleChange(e.target.value);
              }}
              placeholder="e.g. Software Engineer"
              disabled={busy}
              aria-describedby={`${titleId}-hint`}
            />
            </CharLimit>
          </div>{" "}
          {!tracking && inheritedPositionTitle ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTracking(true);
                onPositionTitleChange("");
              }}
              aria-label="Use the case's position title again"
              title="Use the case's position title again"
            >
              <ArrowsClockwiseIcon className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <p id={`${titleId}-hint`} className="text-sm text-muted-foreground">
          {tracking ? "Follows the position title above. Type here to set its own." : "Its own title. The button beside it follows the position title again."}
        </p>
      </div>

      <SocDescriptionSuggestion socCode={socCode} description={description} onDescriptionChange={onDescriptionChange} disabled={busy} />

      <div className="space-y-2">
        <Label htmlFor={textId}>Job description</Label>
        <CharLimit max={INPUT_LIMITS.LONG}>
          <Textarea
            id={textId}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="The duties and requirements, as the job ads and the ETA 9089 will state them"
            disabled={busy}
            className="min-h-40 resize-y"
          />
        </CharLimit>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-border pt-3">
        <TemplateSaveButton
          isExisting={Boolean(matching)}
          isSaving={isSaving}
          disabled={!canSave || templatesBusy || isSaving}
          onClick={() => void save({ name, description }, matching)}
        />{" "}
        {name ? <TemplateTypeBadge isExisting={Boolean(matching)} /> : null}
      </div>

      <Dialog open={!!pendingUpdate} onOpenChange={(open) => !open && setPendingUpdate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template already exists</DialogTitle>
            <DialogDescription>
              A template named &ldquo;{pendingUpdate?.name}&rdquo; already exists. Update it with this text?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingUpdate(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmPendingUpdate()} disabled={isSaving}>
              {isSaving ? "Updating..." : "Update template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
