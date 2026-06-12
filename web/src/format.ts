// Display formatters. All values come from the backend already computed; these only
// shape them for the UI (no math that affects results).

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(n: number): string {
  return usd.format(n);
}

// formatMwh trims trailing zeros: 10.5 stays "10.5", 10 becomes "10". Net energy can
// be negative when transformers outweigh small battery counts.
export function formatMwh(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}`;
}

export function formatArea(n: number): string {
  return `${n.toLocaleString("en-US")} ft²`;
}