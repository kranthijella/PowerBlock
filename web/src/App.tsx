import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  calculate,
  fetchCatalog,
  loadSession,
  saveSession,
} from "./services/api.ts";
import type { CalculateResult, Device, Quantities } from "./types/index.ts";
import { Configurator } from "./components/Configurator.tsx";
import { Summary } from "./components/Summary.tsx";
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
  // shown when a URL share code can't be resumed; the app still loads empty
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const batteries = useMemo(() => devices.filter((d) => d.isBattery), [devices]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      // catalog is required; failing it means the backend is down
      let devices: Device[];
      try {
        const cat = await fetchCatalog(ctrl.signal);
        devices = cat.devices;
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setLoadError(err instanceof ApiError ? err.message : "could not load app data");
        return;
      }
      setDevices(devices);

      // a bad share code shouldn't break the app, just notify and carry on
      const code = readShareCode();
      if (!code) return;
      try {
        const session = await loadSession(code, ctrl.signal);
        setQuantities(session.quantities);
        setSavedCode(session.code);
        setSavedSnapshot(JSON.stringify(session.quantities));
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const notFound = err instanceof ApiError && err.status === 404;
        setSessionNotice(
          notFound
            ? `No saved configuration found for code “${code}”. Starting fresh.`
            : "Couldn’t load that saved configuration. Starting fresh.",
        );
        // drop the bad code so a refresh starts clean
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // debounced recompute; the AbortController drops a stale response if the user
  // changes quantities again before it lands
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
      <header className="app__header">
        <h1 className="app__title">
          Power<span className="app__title-accent">Block</span>
        </h1>
        <p className="app__tagline">Industrial battery site planner</p>
      </header>

      <div className="app">
        <main className="app__main">
        <section className="app__panel app__panel--results">
          <Summary summary={result?.summary ?? null} />
          <SiteLayout layout={result?.layout ?? null} devices={devices} />
        </section>

        <section className="app__panel app__panel--config">
          {sessionNotice && (
            <div className="notice" role="status">
              <span>{sessionNotice}</span>
              <button
                type="button"
                className="notice__close"
                aria-label="Dismiss"
                onClick={() => setSessionNotice(null)}
              >
                ×
              </button>
            </div>
          )}
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