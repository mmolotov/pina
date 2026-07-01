import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { AlertTriangle, Globe, Lock, X, type LucideIcon } from "lucide-react";
import { useI18n, type MessageKey } from "~/lib/i18n";
import type { SpaceRole, SpaceVisibility } from "~/types/api";

interface ActionResult {
  ok: boolean;
  errorMessage?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useCloseOnSuccess(
  state: string,
  data: ActionResult | undefined,
  onClose: () => void,
) {
  const closed = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (state === "idle" && data?.ok && !closed.current) {
      closed.current = true;
      onCloseRef.current();
    }
  }, [state, data]);
}

interface DialogShellProps {
  eyebrow: string;
  title: string;
  lede?: string;
  busy: boolean;
  maxWidth?: string;
  onClose: () => void;
  children: ReactNode;
}

function DialogShell({
  eyebrow,
  title,
  lede,
  busy,
  maxWidth,
  onClose,
  children,
}: DialogShellProps) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const focusables = Array.from(
      box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    const auto = focusables.find(
      (el) => el.getAttribute("data-autofocus") !== null,
    );
    (auto ?? focusables[0])?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const box = boxRef.current;
      if (!box) return;
      const focusables = Array.from(
        box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="dialog-backdrop">
      <div
        aria-label={title}
        aria-modal="true"
        className="dialog-box"
        ref={boxRef}
        role="dialog"
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2
              style={{
                marginTop: ".375rem",
                fontFamily: "var(--font-display)",
                fontSize: "1.375rem",
                fontWeight: 700,
                letterSpacing: "-.02em",
              }}
            >
              {title}
            </h2>
            {lede ? (
              <p
                style={{
                  marginTop: ".5rem",
                  fontSize: ".875rem",
                  lineHeight: 1.6,
                  color: "var(--color-text-muted)",
                  maxWidth: "30rem",
                }}
              >
                {lede}
              </p>
            ) : null}
          </div>
          <button
            aria-label={t("common.close")}
            className="button-secondary btn-sm"
            disabled={busy}
            onClick={onClose}
            style={{ flexShrink: 0 }}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({
  onClose,
  onSubmit,
  busy,
  busyLabel,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  busyLabel: string;
  submitLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div
      style={{
        marginTop: "1.25rem",
        display: "flex",
        justifyContent: "flex-end",
        gap: ".5rem",
      }}
    >
      <button
        className="button-secondary"
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        {t("common.cancel")}
      </button>
      <button
        className="button-primary"
        disabled={busy}
        onClick={onSubmit}
        style={{ minWidth: "9rem" }}
        type="button"
      >
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="inline-msg danger"
      role="alert"
      style={{ marginBottom: "1rem" }}
    >
      <AlertTriangle size={16} />
      <span>{message}</span>
    </div>
  );
}

function LabeledField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="sp-field-label">
      <span>
        {label}
        {optional ? <span className="sp-field-hint"> {optional}</span> : null}
      </span>
      {children}
    </label>
  );
}

function VisPicker({
  value,
  onChange,
}: {
  value: SpaceVisibility;
  onChange: (next: SpaceVisibility) => void;
}) {
  const { t } = useI18n();
  const options: Array<[SpaceVisibility, LucideIcon, string, string]> = [
    ["PRIVATE", Lock, t("common.private"), t("app.spaces.visPrivateDesc")],
    ["PUBLIC", Globe, t("common.public"), t("app.spaces.visPublicDesc")],
  ];
  return (
    <div
      aria-label={t("app.spaces.fieldVisibility")}
      className="sp-vis-options"
      role="radiogroup"
    >
      {options.map(([val, Icon, title, desc]) => (
        <button
          aria-checked={value === val}
          className={`sp-vis-option ${value === val ? "active" : ""}`}
          key={val}
          onClick={() => onChange(val)}
          role="radio"
          type="button"
        >
          <span className="ico">
            <Icon size={18} />
          </span>
          <span>
            <span className="sp-vis-title" style={{ display: "block" }}>
              {title}
            </span>
            <span className="sp-vis-desc">{desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const SELECTABLE_ROLES: SpaceRole[] = ["ADMIN", "MEMBER", "VIEWER"];
const ROLE_LABEL_KEY: Record<SpaceRole, MessageKey> = {
  OWNER: "app.spaces.roleOwner",
  ADMIN: "app.spaces.roleAdmin",
  MEMBER: "app.spaces.roleMember",
  VIEWER: "app.spaces.roleViewer",
};

function RoleSelect({
  value,
  onChange,
  label,
}: {
  value: SpaceRole;
  onChange: (next: SpaceRole) => void;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <select
      aria-label={label}
      className="field"
      onChange={(event) => onChange(event.target.value as SpaceRole)}
      value={value}
    >
      {SELECTABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {t(ROLE_LABEL_KEY[role])}
        </option>
      ))}
    </select>
  );
}

// ─── Concrete dialogs ──────────────────────────────────────────────────

export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("PRIVATE");
  const [localError, setLocalError] = useState("");
  const serverError =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";
  const error = localError || serverError;

  const submit = () => {
    if (!name.trim()) {
      setLocalError(t("app.spaces.errName"));
      return;
    }
    setLocalError("");
    fetcher.submit(
      { name: name.trim(), description: description.trim(), visibility },
      { method: "post" },
    );
  };

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaces.dlgCreateEyebrow")}
      lede={t("app.spaces.dlgCreateLede")}
      onClose={onClose}
      title={t("app.spaces.dlgCreateTitle")}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <div className="sp-form">
        <LabeledField label={t("app.spaces.fieldName")}>
          <input
            className="field"
            data-autofocus="true"
            onChange={(event) => {
              setName(event.target.value);
              if (localError) setLocalError("");
            }}
            placeholder={t("app.spaces.fieldNamePlaceholder")}
            value={name}
          />
        </LabeledField>
        <LabeledField
          label={t("app.spaces.fieldDesc")}
          optional={t("app.spaces.fieldDescOptional")}
        >
          <textarea
            className="field"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("app.spaces.fieldDescPlaceholder")}
            style={{ minHeight: "4.5rem", resize: "vertical" }}
            value={description}
          />
        </LabeledField>
        <div className="sp-field-label">
          <span>{t("app.spaces.fieldVisibility")}</span>
          <VisPicker onChange={setVisibility} value={visibility} />
        </div>
      </div>
      <DialogFooter
        busy={busy}
        busyLabel={t("app.spaces.creating")}
        onClose={onClose}
        onSubmit={submit}
        submitLabel={t("app.spaces.submitCreate")}
      />
    </DialogShell>
  );
}

export function CreateAlbumDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState("");
  const serverError =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";
  const error = localError || serverError;

  const submit = () => {
    if (!name.trim()) {
      setLocalError(t("app.spaceDetail.errName"));
      return;
    }
    setLocalError("");
    fetcher.submit(
      {
        intent: "create-album",
        name: name.trim(),
        description: description.trim(),
      },
      { method: "post" },
    );
  };

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaceDetail.dlgAlbumEyebrow")}
      lede={t("app.spaceDetail.dlgAlbumLede")}
      onClose={onClose}
      title={t("app.spaceDetail.dlgAlbumTitle")}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <div className="sp-form">
        <LabeledField label={t("app.spaces.fieldName")}>
          <input
            className="field"
            data-autofocus="true"
            onChange={(event) => {
              setName(event.target.value);
              if (localError) setLocalError("");
            }}
            placeholder={t("app.spaceDetail.fieldNamePlaceholder")}
            value={name}
          />
        </LabeledField>
        <LabeledField
          label={t("app.spaces.fieldDesc")}
          optional={t("app.spaces.fieldDescOptional")}
        >
          <textarea
            className="field"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("app.spaceDetail.fieldDescPlaceholder")}
            style={{ minHeight: "4.5rem", resize: "vertical" }}
            value={description}
          />
        </LabeledField>
      </div>
      <DialogFooter
        busy={busy}
        busyLabel={t("app.spaces.creating")}
        onClose={onClose}
        onSubmit={submit}
        submitLabel={t("app.spaceDetail.dlgAlbumTitle")}
      />
    </DialogShell>
  );
}

export function CreateSubspaceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("PRIVATE");
  const [localError, setLocalError] = useState("");
  const serverError =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";
  const error = localError || serverError;

  const submit = () => {
    if (!name.trim()) {
      setLocalError(t("app.spaceDetail.errName"));
      return;
    }
    setLocalError("");
    fetcher.submit(
      {
        intent: "create-subspace",
        name: name.trim(),
        description: description.trim(),
        visibility,
      },
      { method: "post" },
    );
  };

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaceDetail.dlgSubEyebrow")}
      lede={t("app.spaceDetail.dlgSubLede")}
      onClose={onClose}
      title={t("app.spaceDetail.dlgSubTitle")}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <div className="sp-form">
        <LabeledField label={t("app.spaces.fieldName")}>
          <input
            className="field"
            data-autofocus="true"
            onChange={(event) => {
              setName(event.target.value);
              if (localError) setLocalError("");
            }}
            placeholder={t("app.spaceDetail.fieldNamePlaceholder")}
            value={name}
          />
        </LabeledField>
        <LabeledField
          label={t("app.spaces.fieldDesc")}
          optional={t("app.spaces.fieldDescOptional")}
        >
          <textarea
            className="field"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("app.spaceDetail.fieldDescPlaceholder")}
            style={{ minHeight: "4rem", resize: "vertical" }}
            value={description}
          />
        </LabeledField>
        <div className="sp-field-label">
          <span>{t("app.spaces.fieldVisibility")}</span>
          <VisPicker onChange={setVisibility} value={visibility} />
        </div>
      </div>
      <DialogFooter
        busy={busy}
        busyLabel={t("app.spaces.creating")}
        onClose={onClose}
        onSubmit={submit}
        submitLabel={t("app.spaceDetail.createSub")}
      />
    </DialogShell>
  );
}

export function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<SpaceRole>("MEMBER");
  const [localError, setLocalError] = useState("");
  const serverError =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";
  const error = localError || serverError;

  const submit = () => {
    if (!userId.trim()) {
      setLocalError(t("app.spaceDetail.errUser"));
      return;
    }
    setLocalError("");
    fetcher.submit(
      { intent: "add-member", userId: userId.trim(), role },
      { method: "post" },
    );
  };

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaceDetail.dlgMemberEyebrow")}
      lede={t("app.spaceDetail.dlgMemberLede")}
      maxWidth="32rem"
      onClose={onClose}
      title={t("app.spaceDetail.dlgMemberTitle")}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <div className="sp-form">
        <LabeledField label={t("app.spaceDetail.fieldUser")}>
          <input
            className="field"
            data-autofocus="true"
            onChange={(event) => {
              setUserId(event.target.value);
              if (localError) setLocalError("");
            }}
            placeholder={t("app.spaceDetail.fieldUserPlaceholder")}
            value={userId}
          />
          <span className="sp-field-hint">
            {t("app.spaceDetail.fieldUserHint")}
          </span>
        </LabeledField>
        <LabeledField label={t("app.spaceDetail.fieldRole")}>
          <RoleSelect
            label={t("app.spaceDetail.fieldRole")}
            onChange={setRole}
            value={role}
          />
        </LabeledField>
      </div>
      <DialogFooter
        busy={busy}
        busyLabel={t("app.spaceDetail.adding")}
        onClose={onClose}
        onSubmit={submit}
        submitLabel={t("app.spaceDetail.addMember")}
      />
    </DialogShell>
  );
}

export function CreateInviteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const [defaultRole, setDefaultRole] = useState<SpaceRole>("MEMBER");
  const [expiration, setExpiration] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const serverError =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";

  const submit = () => {
    fetcher.submit(
      { intent: "create-invite", defaultRole, expiration, usageLimit },
      { method: "post" },
    );
  };

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaceDetail.dlgInvEyebrow")}
      lede={t("app.spaceDetail.dlgInvLede")}
      maxWidth="34rem"
      onClose={onClose}
      title={t("app.spaceDetail.dlgInvTitle")}
    >
      {serverError ? <ErrorBanner message={serverError} /> : null}
      <div className="sp-form">
        <LabeledField label={t("app.spaceDetail.fieldRole")}>
          <RoleSelect
            label={t("app.spaceDetail.fieldRole")}
            onChange={setDefaultRole}
            value={defaultRole}
          />
        </LabeledField>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <LabeledField
            label={t("app.spaceDetail.fieldExpiry")}
            optional={t("app.spaceDetail.optional")}
          >
            <input
              className="field"
              data-autofocus="true"
              onChange={(event) => setExpiration(event.target.value)}
              type="datetime-local"
              value={expiration}
            />
          </LabeledField>
          <LabeledField
            label={t("app.spaceDetail.fieldLimit")}
            optional={t("app.spaceDetail.optional")}
          >
            <input
              className="field"
              min="1"
              onChange={(event) => setUsageLimit(event.target.value)}
              placeholder={t("app.spaceDetail.fieldLimitPlaceholder")}
              type="number"
              value={usageLimit}
            />
          </LabeledField>
        </div>
      </div>
      <DialogFooter
        busy={busy}
        busyLabel={t("app.spaces.creating")}
        onClose={onClose}
        onSubmit={submit}
        submitLabel={t("app.spaceDetail.createInvite")}
      />
    </DialogShell>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  fields,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  fields: Record<string, string>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  useCloseOnSuccess(fetcher.state, fetcher.data, onClose);
  const error =
    fetcher.data && !fetcher.data.ok ? (fetcher.data.errorMessage ?? "") : "";

  return (
    <DialogShell
      busy={busy}
      eyebrow={t("app.spaceDetail.confirmEyebrow")}
      maxWidth="30rem"
      onClose={onClose}
      title={title}
    >
      <p style={{ fontSize: ".9375rem", lineHeight: 1.6 }}>{body}</p>
      {error ? (
        <div
          className="inline-msg danger"
          role="alert"
          style={{ marginTop: "1rem" }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      <div
        style={{
          marginTop: "1.25rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: ".5rem",
        }}
      >
        <button
          className="button-secondary"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          {t("common.cancel")}
        </button>
        <button
          className="button-primary"
          disabled={busy}
          onClick={() => fetcher.submit(fields, { method: "post" })}
          style={{
            minWidth: "8rem",
            background:
              "linear-gradient(135deg,var(--color-danger),var(--color-danger-strong))",
          }}
          type="button"
        >
          {busy ? t("common.saving") : confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}
