/**
 * Saves `blob` as a file (an export the API sent, such as the audit CSV). The link is in the
 * document while it is clicked (Firefox and older Safari ignore a detached one), and the URL
 * lives until the browser has started the download. Shared by the staff portal and the console.
 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
