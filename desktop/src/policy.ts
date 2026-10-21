export const PRODUCTION_ORIGIN = "https://task-web-app.silverjeanscloth.com";
export function resolveOrigin(packaged: boolean, override?: string): string {
  if (packaged || !override) return PRODUCTION_ORIGIN;
  const url = new URL(override);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Development origin must be loopback HTTP");
  return url.origin;
}
export function trustedPage(value: string, origin: string): boolean {
  try { return new URL(value).origin === origin; } catch { return false; }
}
export function safeExternal(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
export interface Bounds { x: number; y: number; width: number; height: number }
export function fitBounds(bounds: Bounds, area: Bounds): Bounds {
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  return { width, height, x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))) };
}
