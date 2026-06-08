const legacyMediaUrlReplacements = new Map([
  ["/generated/videos/1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4", "/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4"],
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function replaceLegacyMediaUrls(value: unknown): unknown {
  if (typeof value === "string") return legacyMediaUrlReplacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map(replaceLegacyMediaUrls);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [legacyMediaUrlReplacements.get(key) ?? key, replaceLegacyMediaUrls(item)]));
  return value;
}

function addStringUrls(target: Set<string>, value: unknown) {
  if (typeof value === "string" && value) target.add(value);
}

function addArrayUrls(target: Set<string>, value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => addStringUrls(target, item));
}

function addSlotUrls(target: Set<string>, value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((slot) => {
    if (isRecord(slot)) addStringUrls(target, slot.url);
  });
}

function addReferenceUrls(target: Set<string>, value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((reference) => {
    if (isRecord(reference)) addStringUrls(target, reference.url);
  });
}

function compactUrlMap(value: unknown, allowedUrls: Set<string>) {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(([url]) => allowedUrls.has(url));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function compactMessageMediaMaps(message: unknown) {
  if (!isRecord(message)) return message;

  const mediaUrls = new Set<string>();
  addArrayUrls(mediaUrls, message.images);
  addArrayUrls(mediaUrls, message.videos);
  addStringUrls(mediaUrls, message.videoUrl);
  addSlotUrls(mediaUrls, message.imageResultSlots);
  addReferenceUrls(mediaUrls, message.imageReferences);

  const nextMessage = { ...message };
  (["imageDimensions", "imagePrompts", "mediaSystemNames", "videoPrompts", "videoPosters", "videoDimensionsMap"] as const).forEach((key) => {
    if (mediaUrls.size === 0) {
      delete nextMessage[key];
      return;
    }
    const compacted = compactUrlMap(nextMessage[key], mediaUrls);
    if (compacted) nextMessage[key] = compacted;
    else delete nextMessage[key];
  });

  return nextMessage;
}

export function compactWorkspaceState(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const state = { ...value };
  if (Array.isArray(state.sessions)) {
    state.sessions = state.sessions.map((session) => {
      if (!isRecord(session) || !Array.isArray(session.messages)) return session;
      return { ...session, messages: session.messages.map(compactMessageMediaMaps) };
    });
  }
  return state;
}

export function hasJsonChanged(previous: unknown, next: unknown) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

export function summarizeWorkspaceState(value: unknown) {
  if (!isRecord(value)) return value;
  const state = { ...value };
  const activeSessionId = typeof state.activeSessionId === "string" ? state.activeSessionId : "";

  if (Array.isArray(state.sessions)) {
    const sessions = state.sessions.filter(isRecord);
    const activeId = activeSessionId && sessions.some((session) => session.id === activeSessionId) ? activeSessionId : typeof sessions[0]?.id === "string" ? sessions[0].id : "";
    state.activeSessionId = activeId || state.activeSessionId;
    state.sessions = sessions.map((session) => {
      if (session.id === activeId) return { ...session, messagesLoaded: true };
      return { ...session, messages: [], messagesLoaded: false };
    });
  }

  return state;
}

export function mergeUnloadedSessions(incoming: unknown, existing: unknown) {
  if (!isRecord(incoming) || !isRecord(existing)) return incoming;
  if (!Array.isArray(incoming.sessions) || !Array.isArray(existing.sessions)) return incoming;

  const existingById = new Map(existing.sessions.filter(isRecord).map((session) => [session.id, session]));
  return {
    ...incoming,
    sessions: incoming.sessions.map((session) => {
      if (!isRecord(session) || session.messagesLoaded !== false || typeof session.id !== "string") return session;
      const previous = existingById.get(session.id);
      if (!previous) return session;
      return {
        ...session,
        messages: Array.isArray(previous.messages) ? previous.messages : [],
        videoTask: session.videoTask ?? previous.videoTask ?? null,
        pendingRequest: session.pendingRequest ?? previous.pendingRequest ?? null,
        pendingRequests: session.pendingRequests ?? previous.pendingRequests ?? [],
      };
    }),
  };
}
