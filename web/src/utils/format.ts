// display-only formatting; the backend already computed every value

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(n: number): string {
  return usd.format(n);
}

// trims trailing zeros (10.5 -> "10.5", 10 -> "10"); can be negative
export function formatMwh(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}`;
}

export function formatArea(n: number): string {
  return `${n.toLocaleString("en-US")} ft²`;
}