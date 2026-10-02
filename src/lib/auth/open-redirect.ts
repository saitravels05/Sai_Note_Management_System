/**
 * Protects against Open Redirect vulnerabilities (CWE-601).
 * Validates that a target URL is strictly a relative internal application path.
 * 
 * Rejects:
 * - External protocols: http://, https://, javascript:, data:
 * - Protocol-relative URLs: //attacker.com
 * - Backslash trickery: /\attacker.com, \example.com
 * - Non-string or null inputs
 */
export function sanitizeRedirectUrl(url: string | null | undefined, fallback: string = "/dashboard"): string {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmed = url.trim();

  // Must begin with a single forward slash and NOT followed by another slash or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Reject URLs containing colon before the first slash or question mark (e.g. javascript:...)
  const firstSlash = trimmed.indexOf("/");
  const firstColon = trimmed.indexOf(":");
  if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) {
    return fallback;
  }

  // Reject encoded control characters or dangerous schemes
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded.startsWith("//") ||
      decoded.startsWith("/\\") ||
      decoded.toLowerCase().includes("javascript:") ||
      decoded.toLowerCase().includes("data:")
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return trimmed;
}
