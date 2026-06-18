/** Grace period before revoking a blob object URL so the download can start. */
const OBJECT_URL_REVOKE_DELAY_MS = 10_000;

/**
 * Trigger a browser download for an in-memory blob.
 *
 * The object URL is revoked on a deferred timer rather than synchronously:
 * revoking in the same task as `click()` can truncate the download for large
 * blobs before the browser has begun reading from the URL. The anchor is
 * attached to the document so the click reliably starts a download across
 * browsers (notably Firefox). Mirrors `triggerUrlDownload` for server URLs.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}
