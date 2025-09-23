"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Eraser, FolderDown, Languages, Play, Save, Volume2 } from "lucide-react";
import { translateText, ttsSynthesize, generateQuiz } from "@/lib/api";
import { loadSessions, saveSession, deleteSession, type LinguaSession } from "@/lib/storage";
import { Toaster } from "@/components/ui/sonner";
import { splitIntoChunks } from "@/lib/chunk";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese (Mandarin)" },
  { value: "ja", label: "Japanese" },
];

export default function WorkspacePage() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("es");
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [sessions, setSessions] = useState<LinguaSession[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const canRun = useMemo(() => text.trim().length > 0 && !!language, [text, language]);

  async function handleTranslate() {
    if (!canRun) return;
    try {
      setLoading(true);
      // Client-side chunking for live progress; server also supports chunking safely.
      const { chunks } = splitIntoChunks(text);
      if (chunks.length > 1) {
        setChunkTotal(chunks.length);
        setChunkProgress(0);
        const outputs: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const res = await translateText(chunks[i], language);
          const out = (res as any).translated || (res as any).translation || "";
          outputs.push(out);
          setChunkProgress(i + 1);
        }
        const combined = outputs.join("\n\n");
        setTranslated(combined);
        toast.success("Translated successfully");
        toast.info(`Translated in ${chunks.length} chunks`);
      } else {
        const res = await translateText(text, language);
        setTranslated(res.translation);
        // Show chunking info and warnings when applicable
        if (res?.chunks && res.chunks > 1) {
          toast.info(`Translated in ${res.chunks} chunks`);
        }
        if (Array.isArray(res?.warnings) && res.warnings.length) {
          toast.message(res.warnings[0]);
        }
        toast.success("Translated successfully");
      }
    } catch (e: any) {
      toast.error(e?.message || "Translation failed");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setChunkProgress(0);
        setChunkTotal(0);
      }, 400);
    }
  }

  async function handleTTS() {
    if (!translated && !text) return;
    try {
      setLoading(true);
      const source = translated || text;
      const { audioBase64, mime } = await ttsSynthesize(source, language);
      const blob = base64ToBlob(audioBase64, mime || "audio/mpeg");
      const url = URL.createObjectURL(blob);
      if (audioSrc) URL.revokeObjectURL(audioSrc);
      setAudioSrc(url);
      toast.success("Audio ready");
    } catch (e: any) {
      // Fallback to browser TTS
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utter = new SpeechSynthesisUtterance(translated || text);
          // Best-effort: pick a voice matching language code if available
          const voices = window.speechSynthesis.getVoices();
          const v = voices.find(v => v.lang?.toLowerCase().startsWith(language.toLowerCase()));
          if (v) utter.voice = v;
          window.speechSynthesis.speak(utter);
          toast.info("Using browser TTS fallback");
        } else {
          toast.error(e?.message || "TTS failed");
        }
      } catch {
        toast.error(e?.message || "TTS failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleQuiz() {
    if (!translated && !text) return;
    try {
      setLoading(true);
      const source = translated || text;
      const res = await generateQuiz(source, language);
      setQuiz(res.quiz);
      toast.success("Quiz generated");
    } catch (e: any) {
      toast.error(e?.message || "Quiz failed");
    } finally {
      setLoading(false);
    }
  }

  function onSave() {
    const session = saveSession({
      source: text,
      targetLang: language,
      translation: translated,
      quiz,
    });
    setSessions(loadSessions());
    toast.success("Session saved");
    return session.id;
  }

  function base64ToBlob(base64: string, mime: string) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mime });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !/(text|markdown|msword|officedocument|pdf)/.test(f.type) &&
      !/\.(txt|md|docx|pdf)$/i.test(f.name)
    ) {
      toast.error("Unsupported file type. Use .txt, .md, .docx or .pdf");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(f);
  }

  function onCopy() {
    const content = translated || text;
    navigator.clipboard.writeText(content).then(() => toast.success("Copied to clipboard"));
  }

  function onClear() {
    setText("");
    setTranslated("");
    setQuiz(null);
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAudioSrc(null);
  }

  function loadFromHistory(s: LinguaSession) {
    setText(s.source);
    setTranslated(s.translation || "");
    setQuiz(s.quiz || null);
    setLanguage(s.targetLang);
    toast("Loaded session");
  }

  function removeFromHistory(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  return (
    <div className="min-h-screen mx-auto w-full max-w-6xl px-6 py-8">
      <Toaster richColors position="top-right" />
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2" aria-label="App header">
          <Languages className="h-5 w-5 text-emerald-600" aria-hidden />
          <h1 className="font-semibold">LinguaLearn Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCopy} aria-label="Copy output"><Copy className="h-4 w-4 mr-2" />Copy</Button>
          <Button variant="outline" onClick={onClear} aria-label="Clear session"><Eraser className="h-4 w-4 mr-2" />Clear</Button>
          <Button onClick={onSave} aria-label="Save session" className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>
      {loading && chunkTotal > 1 ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status" aria-live="polite">
          Translating chunk {chunkProgress}/{chunkTotal}...
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        <Card aria-label="Input panel">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Paste your notes or upload a text file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="language">Target language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" aria-label="Select language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Your notes</Label>
              <Textarea id="notes" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste text or upload a file..." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Input type="file" accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} aria-label="Upload notes file" />
              <Button onClick={handleTranslate} disabled={!canRun || loading} aria-label="Run translation">
                <FolderDown className="h-4 w-4 mr-2" /> Translate
              </Button>
              <Button variant="secondary" onClick={handleTTS} disabled={loading || (!translated && !text)} aria-label="Generate audio">
                <Volume2 className="h-4 w-4 mr-2" /> Listen
              </Button>
              <Button variant="outline" onClick={handleQuiz} disabled={loading || (!translated && !text)} aria-label="Generate quiz">
                <Play className="h-4 w-4 mr-2" /> Practice
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card aria-label="Output panel">
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardDescription>View translations, audio playback, and practice quizzes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="translate" className="w-full">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="translate">Translate</TabsTrigger>
                <TabsTrigger value="listen">Listen</TabsTrigger>
                <TabsTrigger value="practice">Practice</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="translate" className="mt-4">
                <div className="rounded-md border border-border p-3 text-sm min-h-48 whitespace-pre-wrap">
                  {translated || "Run translation to see results here."}
                </div>
              </TabsContent>

              <TabsContent value="listen" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Generate audio from your translated text or original text.</p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleTTS} disabled={loading || (!translated && !text)} aria-label="Play TTS"><Volume2 className="h-4 w-4 mr-2" />Generate Audio</Button>
                  {audioSrc && (
                    <audio ref={audioRef} src={audioSrc} controls className="w-full" aria-label="Text to speech player" />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="practice" className="mt-4 space-y-3">
                <Button variant="secondary" onClick={handleQuiz} disabled={loading || (!translated && !text)} aria-label="Generate quiz now">Generate Quiz</Button>
                {quiz ? (
                  <div className="space-y-4">
                    {quiz.mcq?.length ? (
                      <div>
                        <h3 className="font-semibold mb-2">Multiple Choice</h3>
                        <ul className="space-y-3">
                          {quiz.mcq.map((q: any, idx: number) => (
                            <li key={idx} className="rounded-md border p-3">
                              <p className="font-medium">{q.question}</p>
                              <ul className="mt-2 grid gap-2">
                                {q.options.map((opt: string, oidx: number) => (
                                  <li key={oidx} className="text-sm">• {opt}</li>
                                ))}
                              </ul>
                              <p className="text-xs text-muted-foreground mt-2">Answer: {q.answer}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {quiz.short?.length ? (
                      <div>
                        <h3 className="font-semibold mb-2">Short Answer</h3>
                        <ul className="space-y-3">
                          {quiz.short.map((q: any, idx: number) => (
                            <li key={idx} className="rounded-md border p-3">
                              <p className="font-medium">{q.question}</p>
                              <p className="text-xs text-muted-foreground mt-2">Expected: {q.answer}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Generate a quiz to practice your understanding.</p>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {sessions.length ? (
                  <ul className="space-y-3">
                    {sessions.map((s) => (
                      <li key={s.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{new Date(s.createdAt).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Lang: {s.targetLang}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => loadFromHistory(s)} aria-label="Load session">Load</Button>
                            <Button size="sm" variant="destructive" onClick={() => removeFromHistory(s.id)} aria-label="Delete session">Delete</Button>
                          </div>
                        </div>
                        <p className="text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{s.translation || s.source}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No history yet. Save a session to see it here.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}