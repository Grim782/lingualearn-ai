"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Eraser, FolderDown, Languages, Play, Save, Volume2, Loader2, Pause, Square, Download } from "lucide-react";
import { translateText, ttsSynthesize } from "@/lib/api";
import Link from "next/link";
import { loadSessions, saveSession, deleteSession, type LinguaSession } from "@/lib/storage";
import { Toaster } from "@/components/ui/sonner";
import { splitIntoChunks } from "@/lib/chunk";
import { Progress } from "@/components/ui/progress";
import jsPDF from "jspdf";

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
  const [sessions, setSessions] = useState<LinguaSession[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);
  const [uploadedContent, setUploadedContent] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const canRun = useMemo(() => (text.trim().length > 0 || uploadedContent.trim().length > 0) && !!language, [text, uploadedContent, language]);
  const showProgress = loading && chunkTotal > 1;
  const progressPct = useMemo(
    () => (chunkTotal > 0 ? Math.round((chunkProgress / chunkTotal) * 100) : 0),
    [chunkProgress, chunkTotal]
  );
  const charCount = useMemo(() => text.length, [text]);
  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  async function handleTranslate() {
    if (!canRun) return;
    try {
      setLoading(true);
      const source = uploadedContent.trim().length > 0 ? uploadedContent : text;
      // Client-side chunking for live progress; server also supports chunking safely.
      const { chunks } = splitIntoChunks(source);
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
        const res = await translateText(source, language);
        setTranslated(res.translation);
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
    if (!translated && !text && !uploadedContent) return;
    try {
      setLoading(true);
      const source = translated || text || uploadedContent;
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
          const utter = new SpeechSynthesisUtterance(translated || text || uploadedContent);
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

  function onSave() {
    const session = saveSession({
      source: text.trim().length > 0 ? text : uploadedContent,
      targetLang: language,
      translation: translated,
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
    reader.onload = () => {
      setUploadedContent(String(reader.result || ""));
      setUploadedFileName(f.name);
      toast.success("File added. Ready to translate");
    };
    reader.readAsText(f);
  }

  function removeFile() {
    setUploadedContent("");
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    const f = ev.dataTransfer.files?.[0];
    if (!f) return;
    const fakeEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    onFile(fakeEvent);
  }
  function handleDragOver(ev: React.DragEvent<HTMLDivElement>) { ev.preventDefault(); }

  function onCopy() {
    const content = translated || text;
    navigator.clipboard.writeText(content).then(() => toast.success("Copied to clipboard"));
  }

  function onClear() {
    setText("");
    setTranslated("");
    setUploadedContent("");
    setUploadedFileName("");
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAudioSrc(null);
  }

  function exportPDF() {
    if (!translated.trim()) {
      toast.error("Nothing to export");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(12);
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(translated, maxWidth);
    doc.text(lines, margin, 20);
    doc.save("lingualearn-translation.pdf");
  }

  function playAudio() { audioRef.current?.play(); }
  function pauseAudio() { audioRef.current?.pause(); }
  function stopAudio() { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } }
  function downloadAudio() {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `lingualearn-${language}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function loadFromHistory(s: LinguaSession) {
    setText(s.source);
    setTranslated(s.translation || "");
    setLanguage(s.targetLang);
    toast("Loaded session");
  }

  function removeFromHistory(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [audioSrc]);

  function togglePlayStop() {
    if (!audioRef.current) return;
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
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
      {showProgress && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status" aria-live="polite">
          Translating chunk {chunkProgress}/{chunkTotal} ({progressPct}%)...
          <div className="mt-2">
            <Progress value={progressPct} className="h-2" />
          </div>
        </div>
      )}

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
              <Textarea id="notes" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste text or upload a file..." disabled={!!uploadedFileName} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{uploadedFileName ? "File selected — textarea disabled" : `${wordCount} words`}</span>
                <span>{charCount} characters</span>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full rounded-md border-2 border-dashed border-border p-4 text-sm bg-accent/30"
              aria-label="Upload notes file dropzone"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                  className="hidden"
                />
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} aria-label="Browse file">
                  <FolderDown className="h-4 w-4 mr-2" /> Browse file
                </Button>
                {uploadedFileName ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-xs">
                    {uploadedFileName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Or drag & drop here</span>
                )}
                {uploadedFileName && (
                  <Button type="button" variant="outline" size="sm" onClick={removeFile} aria-label="Remove file">Remove</Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleTranslate} disabled={!canRun || loading} aria-label="Run translation">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Working...</>
                ) : (
                  <><FolderDown className="h-4 w-4 mr-2" /> Translate</>
                )}
              </Button>
              <Button variant="secondary" onClick={handleTTS} disabled={loading || (!translated && !text && !uploadedContent)} aria-label="Generate audio">
                <Volume2 className="h-4 w-4 mr-2" /> Listen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card aria-label="Output panel">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Output</CardTitle>
                <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">Source: {uploadedContent.trim().length > 0 ? "file" : "typed"}</span>
              </div>
              {audioSrc ? (
                <Button size="sm" variant="outline" onClick={togglePlayStop} aria-label={isPlaying ? "Stop audio" : "Play audio"}>
                  {isPlaying ? <Square className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {isPlaying ? "Stop" : "Play"}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={handleTTS} aria-label="Generate audio">
                  <Volume2 className="h-3.5 w-3.5 mr-1" /> Generate Audio
                </Button>
              )}
            </div>
            <CardDescription>View translations and audio playback. Your history is saved.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="translate" className="w-full">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="translate">Translate</TabsTrigger>
                <TabsTrigger value="listen">Listen</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="translate" className="mt-4">
                <div className="flex items-center justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={exportPDF} disabled={!translated.trim()} aria-label="Export PDF">
                    <Download className="h-4 w-4 mr-2" /> Export PDF
                  </Button>
                </div>
                <div className="rounded-md border border-border p-3 text-sm min-h-48 whitespace-pre-wrap">
                  {translated || "Run translation to see results here."}
                </div>
              </TabsContent>

              <TabsContent value="listen" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Generate audio from your translated text or original text.</p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleTTS} disabled={loading || (!translated && !text && !uploadedContent)} aria-label="Generate Audio"><Volume2 className="h-4 w-4 mr-2" />Generate Audio</Button>
                </div>
                {audioSrc && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={playAudio} aria-label="Play"><Play className="h-4 w-4 mr-2" />Play</Button>
                      <Button size="sm" variant="outline" onClick={pauseAudio} aria-label="Pause"><Pause className="h-4 w-4 mr-2" />Pause</Button>
                      <Button size="sm" variant="destructive" onClick={stopAudio} aria-label="Stop"><Square className="h-4 w-4 mr-2" />Stop</Button>
                      <Button size="sm" variant="outline" onClick={downloadAudio} aria-label="Download audio"><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                    <audio ref={audioRef} src={audioSrc} controls className="w-full" aria-label="Text to speech player" />
                  </div>
                )}
              </TabsContent>

              {/* Practice moved to dedicated page at /practice */}

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