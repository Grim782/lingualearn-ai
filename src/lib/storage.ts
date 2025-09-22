export type LinguaSession = {
  id: string;
  createdAt: number;
  source: string;
  targetLang: string;
  translation?: string;
  quiz?: any;
};

const KEY = "lingualearn_sessions_v1";

export function loadSessions(): LinguaSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LinguaSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(s: Omit<LinguaSession, "id" | "createdAt">): LinguaSession {
  const list = loadSessions();
  const item: LinguaSession = { id: crypto.randomUUID(), createdAt: Date.now(), ...s };
  try {
    localStorage.setItem(KEY, JSON.stringify([item, ...list]).slice(0, 10000));
  } catch {
    // ignore quota errors
  }
  return item;
}

export function deleteSession(id: string) {
  const list = loadSessions();
  const next = list.filter((s) => s.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}