export async function translateText(text: string, targetLang: string) {
  const r = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLang }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Failed to translate");
  return r.json();
}

export async function ttsSynthesize(text: string, targetLang: string) {
  const r = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLang }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Failed to synthesize");
  return r.json();
}

export async function generateQuiz(
  text: string,
  targetLang: string,
  options?: { difficulty?: "easy" | "medium" | "hard"; count?: number }
) {
  const r = await fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLang, difficulty: options?.difficulty, count: options?.count }),
  });
  if (!r.ok) throw new Error((await r.json()).error || "Failed to generate quiz");
  return r.json();
}