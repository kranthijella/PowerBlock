import { useState } from "react";

interface Props {
  onSave: () => void;
  saving: boolean;
  savedCode: string | null;
  shareUrl: string | null;
  dirty: boolean;
  canSave: boolean;
  error: string | null;
}


export function SessionBar({ onSave, saving, savedCode, shareUrl, dirty, canSave, error }: Props) {
  const [copied, setCopied] = useState(false);

  const [revealed, setRevealed] = useState(false);

  const save = () => {
    setRevealed(true);
    setCopied(false);
    onSave();
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setRevealed(false), 1200); // hide again after a moment
    } catch {
      // clipboard blocked (insecure context); code stays visible to copy by hand
    }
  };

  const showSaved = savedCode && revealed;

  return (
    <div className="session-bar">
      <div className="session-bar__row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={saving || !canSave}
        >
          {saving ? "Saving…" : savedCode ? "Save again" : "Save configuration"}
        </button>

        {showSaved && (
          <div className="session-bar__saved">
            <span className="session-bar__label">Share code</span>
            <code className="session-bar__code">{savedCode}</code>
            <button type="button" className="btn btn--ghost" onClick={copy}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        )}
      </div>

      {showSaved && dirty && (
        <p className="session-bar__hint">Unsaved changes — save again to update the link.</p>
      )}
      {showSaved && !dirty && (
        <p className="session-bar__hint muted">
          Open this link anywhere to resume — it survives a browser cache clear.
        </p>
      )}
      {error && <p className="session-bar__error">{error}</p>}
    </div>
  );
}