"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IoAlertCircleOutline, IoCheckmarkCircleOutline, IoClose } from "react-icons/io5";

// ---------- Card ----------

export function Card({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-card border border-hairline bg-card shadow-[0_1px_2px_rgba(34,34,34,0.03)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

// ---------- Buttons ----------

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  variant = "secondary",
  className = "",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  busy?: boolean;
}) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-maroon text-white hover:bg-maroon-dark disabled:bg-maroon/50",
    secondary:
      "border border-hairline bg-card text-ink hover:bg-card-alt disabled:opacity-50",
    ghost: "text-subtle hover:bg-field hover:text-ink disabled:opacity-50",
    destructive:
      "border border-destructive/30 bg-card text-destructive hover:bg-destructive/5 disabled:opacity-50",
  };
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {busy && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {props.children}
    </button>
  );
}

// ---------- Form fields ----------

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-subtle">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const fieldCls =
  "w-full rounded-lg bg-field px-3 text-sm text-ink outline-none ring-maroon/30 transition focus:bg-card focus:ring-2 border border-transparent focus:border-maroon/40";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} h-9 ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${fieldCls} py-2 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldCls} h-9 ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-maroon" : "bg-[#d8d4cd]"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ---------- Badges ----------

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "maroon" | "gold" | "green" | "red" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    maroon: "bg-maroon-light text-maroon",
    gold: "bg-gold-light text-[#7a6428]",
    green: "bg-[#e7f2e4] text-[#3d6b2f]",
    red: "bg-[#fdeaea] text-[#b3261e]",
    neutral: "bg-field text-subtle",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "sent" || status === "Active" || status === "active"
      ? "green"
      : status === "rejected" || status === "error" || status === "canceled"
        ? "red"
        : status === "pending" || status === "scheduled"
          ? "gold"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

// ---------- Skeletons ----------

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#eceae5] ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ---------- Empty / error ----------

export function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted">{text}</p>;
}

export function ErrorNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-[#fdeaea] px-3 py-2 text-sm text-[#b3261e]">
      <IoAlertCircleOutline className="shrink-0" /> {text}
    </p>
  );
}

// ---------- Modal ----------

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`mt-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-card border border-hairline bg-card shadow-xl`}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-field hover:text-ink"
            aria-label="Close"
          >
            <IoClose size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Typed-confirmation dialog for destructive actions.
export function ConfirmDialog({
  title,
  message,
  confirmWord,
  actionLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmWord?: string;
  actionLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !confirmWord || typed === confirmWord;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-subtle">{message}</div>
        {confirmWord && (
          <Field label={`Type "${confirmWord}" to confirm`}>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </Field>
        )}
        {error && <ErrorNote text={error} />}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Toasts ----------

type Toast = { id: number; text: string; kind: "success" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-card border px-3.5 py-2.5 text-sm shadow-lg ${
              t.kind === "error"
                ? "border-destructive/30 bg-[#fdf3f2] text-[#b3261e]"
                : "border-hairline bg-card text-ink"
            }`}
          >
            {t.kind === "error" ? (
              <IoAlertCircleOutline className="mt-0.5 shrink-0 text-destructive" />
            ) : (
              <IoCheckmarkCircleOutline className="mt-0.5 shrink-0 text-[#3d6b2f]" />
            )}
            <span className="min-w-0 break-words">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Misc ----------

export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name ?? ""}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  const initials = (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-maroon-light text-[11px] font-semibold text-maroon"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function Thumb({ src, size = 36 }: { src?: string | null; size?: number }) {
  if (!src)
    return (
      <span
        className="inline-block shrink-0 rounded-lg bg-field"
        style={{ width: size, height: size }}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-field p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === t.key ? "bg-card text-ink shadow-sm" : "text-subtle hover:text-ink"
          }`}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className="rounded-full bg-maroon px-1.5 text-[10px] font-bold text-white">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
