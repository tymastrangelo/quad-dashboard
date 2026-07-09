"use client";

import { useState, type ReactNode } from "react";
import { Button, ErrorNote, Field, Input, Modal, Select, TextArea, Toggle } from "@/components/ui";

export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "boolean" | "datetime" | "select";
  options?: string[]; // for select
  hint?: string;
};

// Generic edit form: seeds from the row, submits only the keys that changed
// (the update RPCs apply jsonb patches).
export function EditModal({
  title,
  fields,
  initial,
  onSave,
  onClose,
  extra,
}: {
  title: string;
  fields: FieldSpec[];
  initial: Record<string, unknown>;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const toLocal = (v: unknown) => {
    if (!v) return "";
    const d = new Date(String(v));
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const seed = () => {
    const s: Record<string, string | boolean> = {};
    for (const f of fields) {
      const v = initial[f.key];
      s[f.key] = f.kind === "boolean" ? Boolean(v) : f.kind === "datetime" ? toLocal(v) : String(v ?? "");
    }
    return s;
  };
  const [values, setValues] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.kind === "boolean") {
        if (v !== Boolean(initial[f.key])) patch[f.key] = v;
      } else if (f.kind === "datetime") {
        const orig = toLocal(initial[f.key]);
        if (v !== orig) patch[f.key] = v ? new Date(String(v)).toISOString() : null;
      } else {
        const orig = String(initial[f.key] ?? "");
        if (v !== orig) patch[f.key] = String(v).trim() === "" ? null : String(v);
      }
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
              {f.kind === "boolean" ? (
                <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2.5">
                  <span className="text-sm font-medium text-subtle">{f.label}</span>
                  <Toggle
                    checked={Boolean(values[f.key])}
                    onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  />
                </div>
              ) : (
                <Field label={f.label} hint={f.hint}>
                  {f.kind === "textarea" ? (
                    <TextArea
                      value={String(values[f.key])}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  ) : f.kind === "select" ? (
                    <Select
                      value={String(values[f.key])}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={f.kind === "datetime" ? "datetime-local" : "text"}
                      value={String(values[f.key])}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              )}
            </div>
          ))}
        </div>
        {extra}
        {error && <ErrorNote text={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
