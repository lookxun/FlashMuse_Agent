function countCjk(text: string) {
  return (text.match(/[\u3400-\u9fff]/g) ?? []).length;
}

function countMojibakeMarkers(text: string) {
  return (text.match(/[ÃÂâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]|ï¼|ã€|â€|ðŸ/g) ?? []).length;
}

function tryDecodeLatin1Utf8(text: string) {
  if (!text || !/[\u00c0-\u00ff]/.test(text)) return text;
  if (Array.from(text).some((char) => char.charCodeAt(0) > 255)) return text;

  try {
    const bytes = Uint8Array.from(Array.from(text), (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return text;
  }
}

export function repairUtf8Mojibake(text: string) {
  if (!text || countMojibakeMarkers(text) < 4) return text;

  const decoded = tryDecodeLatin1Utf8(text);
  if (decoded === text) return text;

  const beforeCjk = countCjk(text);
  const afterCjk = countCjk(decoded);
  const beforeMarkers = countMojibakeMarkers(text);
  const afterMarkers = countMojibakeMarkers(decoded);

  if (afterCjk >= Math.max(5, beforeCjk + 5) && afterMarkers < beforeMarkers) return decoded;
  return text;
}

export function stripSystemReminders(text: string) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ");
}

export function sanitizeModelOutputText(text: string) {
  return stripSystemReminders(repairUtf8Mojibake(text));
}
