"use client";

import { useState } from "react";
import { BriefcaseIcon, CheckIcon, CopyIcon, PencilIcon, TrashIcon } from "@phosphor-icons/react";

import type { Id } from "@convex/_generated/dataModel";
import { JobDescriptionEditor } from "@/components/job-description/JobDescriptionEditor";
import { copyToClipboard } from "@/components/job-description/shared";
import { SocCodeCard } from "@/components/soc/SocCodeSummary";
import { Button } from "@/components/ui/button";
import { handleOperationError } from "@/lib/errors";
import { descriptionBlocks } from "@/lib/jobDescriptionText";
import type { CaseDetailData } from "./case-detail-types";
import { fmtCurrency } from "./case-detail-utils";

/** Saving and clearing the case's job description. Each throws when the write fails, so the editor stays open. */
export interface JobDescEditProps {
  onSave: (positionTitle: string, description: string, templateId?: Id<"jobDescriptionTemplates">) => Promise<void>;
  onClear: () => Promise<void>;
}

/**
 * The case page's job card: the position, the SOC code with its card (the job's median offered wage, how often
 * DOL certifies it, how other employers title it, and a link to the code's page), the wage offered, and the
 * job description as written. Edit opens the same editor the case form uses (`JobDescriptionEditor`), with
 * the suggestion from the SOC code inside it.
 */
export function JobDescriptionCard({ caseData, jobDescProps }: { caseData: CaseDetailData; jobDescProps?: JobDescEditProps }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState<Id<"jobDescriptionTemplates"> | undefined>();
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasDescription = Boolean(caseData.jobDescription || caseData.jobDescriptionPositionTitle);
  if (!hasDescription && !jobDescProps && !caseData.socCode) return null;

  function startEditing() {
    setTitle(caseData.jobDescriptionPositionTitle || "");
    setText(caseData.jobDescription || "");
    setTemplateId(caseData.jobDescriptionTemplateId);
    setEditing(true);
  }

  async function save() {
    if (!jobDescProps) return;
    setSaving(true);
    try {
      await jobDescProps.onSave(title.trim(), text.trim(), templateId);
      setEditing(false);
    } catch (error) {
      // The words stay in the editor, so nothing typed is lost.
      handleOperationError(error, { userMessage: "Couldn’t save the job description. Your text is still here; try again." });
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!jobDescProps) return;
    setClearing(true);
    try {
      await jobDescProps.onClear();
      setEditing(false);
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t clear the job description. Try again." });
    } finally {
      setClearing(false);
    }
  }

  async function copy() {
    const value = editing ? text : caseData.jobDescription;
    if (value && (await copyToClipboard(value))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const blocks = descriptionBlocks(caseData.jobDescription || "");
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        <h2 className="flex items-center gap-1.5">
          <BriefcaseIcon className="h-3.5 w-3.5" aria-hidden="true" />
          The job
        </h2>
        <div className="flex items-center gap-1">
          {caseData.jobDescription || (editing && text) ? (
            <button type="button" onClick={() => void copy()} className="icon-btn" title="Copy the job description" aria-label="Copy the job description">
              {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ) : null}
          {jobDescProps && !editing ? (
            <button type="button" onClick={startEditing} className="icon-btn" title="Edit the job description" aria-label="Edit the job description">
              <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="field-grid">
        <div className="field-cell">
          <div className="fc-label">Position</div>
          <div className={`fc-val fc-val-text ${!caseData.positionTitle ? "dim" : ""}`} title={caseData.positionTitle || undefined}>
            {caseData.jobDescriptionPositionTitle || caseData.positionTitle || "-"}
          </div>
        </div>
        <div className="field-cell">
          <div className="fc-label">SOC code</div>
          <div className={`fc-val fc-val-text ${!caseData.socCode ? "dim" : ""}`} title={caseData.socTitle || undefined}>
            {caseData.socCode ? (
              <>
                <span className="font-mono">{caseData.socCode}</span> {caseData.socTitle || ""}
              </>
            ) : (
              "-"
            )}
          </div>
        </div>
        <div className="field-cell">
          <div className="fc-label">Wage offered</div>
          <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
            {caseData.pwdWageAmount !== undefined ? `${fmtCurrency(caseData.pwdWageAmount)} / yr` : "-"}
          </div>
        </div>
      </div>

      {caseData.socCode ? (
        <div className="detail-card-body border-t-2 border-border">
          <SocCodeCard code={caseData.socCode} />
        </div>
      ) : null}

      {editing && jobDescProps ? (
        <div className="detail-card-body flex flex-col gap-3 border-t-2 border-border">
          <JobDescriptionEditor
            idPrefix="case-page-jd"
            inheritedPositionTitle={caseData.positionTitle}
            positionTitle={title}
            description={text}
            socCode={caseData.socCode}
            templateId={templateId}
            onPositionTitleChange={setTitle}
            onDescriptionChange={setText}
            onTemplateChange={setTemplateId}
            disabled={saving}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-border pt-3">
            {hasDescription ? (
              <Button variant="ghost" className="text-destructive-text" onClick={() => void clear()} loading={clearing} loadingText="Clearing...">
                <TrashIcon aria-hidden="true" />
                Remove the job description
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={!text.trim()} loading={saving} loadingText="Saving...">
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : blocks.length ? (
        <div className="detail-card-body space-y-3 border-t-2 border-border">
          <p className="text-sm font-semibold">Job description</p>
          {blocks.map((b, i) =>
            b.kind === "paragraph" ? (
              <p key={i} className="max-w-prose text-base leading-relaxed">
                {b.text}
              </p>
            ) : (
              <ul key={i} className="space-y-1.5">
                {b.items.map((item, j) => (
                  <li key={j} className="req-item">
                    <span className="req-bullet" aria-hidden="true">·</span> {item}
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
      ) : (
        <div className="detail-card-body border-t-2 border-border">
          <div className="detail-empty-state">
            <div className="detail-empty-state-title">No job description yet</div>
            <div className="detail-empty-state-desc">
              {jobDescProps
                ? caseData.socCode
                  ? `Edit to write one, or start from the description O*NET gives SOC ${caseData.socCode}.`
                  : "Edit to write one."
                : "Add one in the case form."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
