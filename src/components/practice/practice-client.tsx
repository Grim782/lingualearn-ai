"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Play, FolderDown, Eraser } from "lucide-react";
import { generateQuiz } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";

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

export type ShortQA = { question: string; answer?: string };

export const PracticeClient = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("es");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [uploadedContent, setUploadedContent] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<{ short: ShortQA[] } | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<
    | null
    | {
        correct: number;
        total: number;
        wrong: { index: number; question: string; your: string; correct: string }[];
      }
  >(null);

  const canGenerate = useMemo(() => (text.trim().length > 0 || uploadedContent.trim().length > 0), [text, uploadedContent]);

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
      toast.success("File added. Ready to generate quiz");
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

  function normalizeAnswer(s: string) {
    return (s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
  }

  async function handleQuiz() {
    if (!canGenerate) return;
    try {
      setLoading(true);
      const source = uploadedContent.trim().length > 0 ? uploadedContent : text;
      const res = await generateQuiz(source, language, { difficulty, count: 10 });
      const items: ShortQA[] = (res?.quiz?.short || []) as ShortQA[];
      setQuiz({ short: items });
      setAnswers(Array.from({ length: items.length }, () => ""));
      setResult(null);
      toast.success("Quiz generated");
    } catch (e: any) {
      toast.error(e?.message || "Quiz failed");
    } finally {
      setLoading(false);
    }
  }

  function scoreQuiz() {
    if (!quiz?.short?.length) return;
    const wrong: { index: number; question: string; your: string; correct: string }[] = [];
    let correct = 0;
    quiz.short.forEach((q, i) => {
      const expected = normalizeAnswer(q.answer || "");
      const got = normalizeAnswer(answers[i] || "");
      if (expected && got && (got === expected || expected.includes(got) || got.includes(expected))) {
        correct += 1;
      } else if (expected || got) {
        wrong.push({ index: i, question: q.question, your: answers[i] || "", correct: q.answer || "" });
      } else {
        wrong.push({ index: i, question: q.question, your: "", correct: q.answer || "" });
      }
    });
    setResult({ correct, total: quiz.short.length, wrong });
  }

  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);
  const charCount = useMemo(() => text.length, [text]);

  return (
    <div className="min-h-screen mx-auto w-full max-w-5xl px-6 py-8">
      <Toaster richColors position="top-right" />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Practice – Quiz Generator</h1>
          <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">Separate Page</span>
        </div>
        <div className="text-xs text-muted-foreground">Create 10 short-answer questions from your notes.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <CardDescription>Paste notes or upload a file (we won't show raw file content here).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="language">Target language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
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
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                  className="hidden"
                />
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
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
                  <Button type="button" variant="outline" size="sm" onClick={removeFile}>Remove</Button>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="difficulty" className="text-xs">Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger id="difficulty" className="w-[180px]">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleQuiz} disabled={!canGenerate || loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Working...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Generate Quiz</>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setText(""); removeFile(); setQuiz(null); setAnswers([]); setResult(null); }}>
                <Eraser className="h-4 w-4 mr-2" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Practice</CardTitle>
              <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">Source: {uploadedContent.trim().length > 0 ? "file" : (text.trim().length > 0 ? "typed" : "none")}</span>
            </div>
            <CardDescription>Answer the questions. Short answers only, no options.</CardDescription>
          </CardHeader>
          <CardContent>
            {quiz?.short?.length ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">There are {quiz.short.length} questions.</div>
                <ul className="space-y-3">
                  {quiz.short.map((q, idx) => (
                    <li key={idx} className="rounded-md border p-3">
                      <p className="font-medium mb-2">{idx + 1}. {q.question}</p>
                      <Input
                        placeholder="Type your answer"
                        value={answers[idx] || ""}
                        onChange={(e) => {
                          const next = answers.slice();
                          next[idx] = e.target.value;
                          setAnswers(next);
                        }}
                        aria-label={`Answer for question ${idx + 1}`}
                      />
                      {result && result.wrong.find(w => w.index === idx) ? (
                        <p className="mt-2 text-xs text-destructive">Correct answer: {q.answer || "(not provided)"}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2">
                  <Button onClick={scoreQuiz}>Done</Button>
                  <Button variant="outline" onClick={() => { setAnswers(Array.from({ length: quiz.short.length }, () => "")); setResult(null); }}>Reset Answers</Button>
                </div>

                {result ? (
                  <div className="rounded-md border bg-accent/40 p-3">
                    <p className="font-medium">Score: {result.correct} / {result.total}</p>
                    {result.wrong.length > 0 ? (
                      <div className="mt-2 text-sm">
                        <p className="font-medium mb-1">Review incorrect answers:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {result.wrong.map(w => (
                            <li key={w.index}>
                              <span className="font-medium">Q{w.index + 1}:</span> {w.question}
                              <div className="text-xs text-muted-foreground">Your answer: {w.your || "(empty)"}</div>
                              <div className="text-xs">Correct: {w.correct || "(not provided)"}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm mt-1">Excellent! All answers correct.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Generate a quiz to practice your understanding.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};