import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  calculate,
  fetchCatalog,
  loadSession,
  saveSession,
  type CalculateResult,
  type Device,
  type Quantities,
} from "./api.ts";
import { Configurator } from "./components/Configurator.tsx";
import { SummaryPanel } from "./components/Summary.tsx";
import { SiteLayout } from "./components/SiteLayout.tsx";
import { SessionBar } from "./components/SessionBar.tsx";

const MAX_QTY = 1000; // mirrors maxQtyPerDevice in the backend
const CALC_DEBOUNCE_MS = 250;

function readShareCode(): string | null {
  return new URLSearchParams(window.location.search).get("s");
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [quantities, setQuantities] = useState<Quantities>({});
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Saved-session tracking: the share code and a snapshot of the quantities at save
  // time, so we can tell the user when their current edits are unsaved.
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const batteries = useMemo(() => devices.filter((d) => d.isBattery), [devices]);

  // On mount: load the catalog and, if the URL carries a code, the saved session.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const code = readShareCode();
        const [cat, session] = await Promise.all([
          fetchCatalog(ctrl.signal),
          code ? loadSession(code, ctrl.signal) : Promise.resolve(null),
        ]);
        setDevices(cat.devices);
        if (session) {
          setQuantities(session.quantities);
          setSavedCode(session.code);
          setSavedSnapshot(JSON.stringify(session.quantities));
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const msg = err instanceof ApiError ? err.message : "could not load app data";
        setLoadError(msg);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Recompute totals + layout whenever quantities change, debounced so each keystroke
  // on a stepper doesn't fire a request. A fresh AbortController cancels any in-flight
  // calculation so a slow response can't overwrite a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      calculate(quantities, ctrl.signal)
        .then((r) => {
          setResult(r);
          setCalcError(null);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setCalcError(err instanceof ApiError ? err.message : "calculation failed");
        });
    }, CALC_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [quantities]);

  const setQuantity = useCallback((name: string, qty: number) => {
    const clamped = Math.max(0, Math.min(MAX_QTY, Math.floor(qty || 0)));
    setQuantities((prev) => ({ ...prev, [name]: clamped }));
  }, []);

  const reset = useCallback(() => setQuantities({}), []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { code } = await saveSession(quantities);
      setSavedCode(code);
      setSavedSnapshot(JSON.stringify(quantities));
      const url = `${window.location.pathname}?s=${code}`;
      window.history.replaceState(null, "", url);
      setCalcError(null);
    } catch (err) {
      setCalcError(err instanceof ApiError ? err.message : "could not save session");
    } finally {
      setSaving(false);
    }
  }, [quantities]);

  // Has the user edited since the last save? Used to nudge them to re-save.
  const dirty = savedCode !== null && JSON.stringify(quantities) !== savedSnapshot;
  const totalUnits = useMemo(
    () => Object.values(quantities).reduce((a, b) => a + (b > 0 ? b : 0), 0),
    [quantities],
  );

  const shareUrl = savedCode
    ? `${window.location.origin}${window.location.pathname}?s=${savedCode}`
    : null;

  if (loadError) {
    return (
      <div className="app app--error">
        <p>Could not reach the PowerBlock backend: {loadError}</p>
        <p>Is the server running on :8000?</p>
      </div>
    );
  }

  return (
    <>
      {/* full-width header: logo flush to the left edge of the viewport */}
      <header className="app__header">
        <h1 className="app__title">
          Power<span className="app__title-accent">Block</span>
        </h1>
        <p className="app__tagline">Industrial battery site planner</p>
      </header>

      <div className="app">
        <main className="app__main">
        {/* Results + to-scale layout on the left */}
        <section className="app__panel app__panel--results">
          <SummaryPanel summary={result?.summary ?? null} />
          <SiteLayout layout={result?.layout ?? null} devices={devices} />
        </section>

        {/* Inputs + save/resume on the right */}
        <section className="app__panel app__panel--config">
          <Configurator
            batteries={batteries}
            quantities={quantities}
            onChange={setQuantity}
            onReset={reset}
            maxQty={MAX_QTY}
          />
          <SessionBar
            onSave={handleSave}
            saving={saving}
            savedCode={savedCode}
            shareUrl={shareUrl}
            dirty={dirty}
            canSave={totalUnits > 0}
            error={calcError}
          />
        </section>
        </main>
      </div>
    </>
  );
}