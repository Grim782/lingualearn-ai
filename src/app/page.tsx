"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Headphones, Languages, NotebookPen, Quote, Sparkles, Star, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="LinguaLearn AI home">
            <motion.div initial={{ rotate: -8, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 120 }} className="h-8 w-8 rounded-md bg-emerald-600 grid place-items-center text-white">
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <span className="font-semibold tracking-tight">LinguaLearn AI</span>
          </Link>
          <nav className="flex items-center gap-3" aria-label="Primary">
            <Link href="#features" className="text-sm hover:underline">Features</Link>
            <Link href="#testimonials" className="text-sm hover:underline">Testimonials</Link>
            <Link href="#footer" className="text-sm hover:underline">Contact</Link>
            <Button asChild className="ml-2 bg-emerald-600 hover:bg-emerald-700">
              <Link href="/app" aria-label="Open LinguaLearn workspace">Open App</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(600px_300px_at_10%_-10%,oklch(0.88_0.06_160_/_0.6),transparent_60%),radial-gradient(500px_220px_at_90%_10%,oklch(0.9_0.08_210_/_0.5),transparent_60%)]" />
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl/tight font-extrabold tracking-tight">
              Breaking Language Barriers in Education
            </motion.h1>
            <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-4 text-base md:text-lg text-muted-foreground max-w-prose">
              Translate, listen, and practice your study materials in your own language. Inclusive, accessible, and powered by AI.
            </motion.p>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/app" aria-label="Get started with LinguaLearn">Get Started</Link>
              </Button>
              <Button asChild variant="outline">
                <a href="#features" aria-label="Learn more about features">Learn More</a>
              </Button>
            </motion.div>
            {/* Re-styled feature highlights as pill buttons for better visual flow */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="secondary" className="justify-start rounded-full px-4 py-5 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> 95+ Lighthouse target
              </Button>
              <Button variant="secondary" className="justify-start rounded-full px-4 py-5 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> TTS in 100+ languages
              </Button>
              <Button variant="secondary" className="justify-start rounded-full px-4 py-5 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Quiz generation
              </Button>
            </div>
          </div>
          <motion.figure initial={{ scale: 0.96, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-sm">
            <img src="https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=1600&auto=format&fit=crop" alt="Students learning with devices" className="absolute inset-0 h-full w-full object-cover" />
          </motion.figure>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">Everything you need to learn in any language</h2>
          <p className="text-muted-foreground mt-2">Built with accessibility, performance, and delightful motion.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Languages, title: "Translate", desc: "High-quality translation powered by M2M100." },
            { icon: Headphones, title: "Listen", desc: "Natural text-to-speech with MMS-TTS." },
            { icon: NotebookPen, title: "Practice", desc: "Auto quizzes via FLAN-T5." },
            { icon: Zap, title: "Fast", desc: "Edge-ready API routes with caching." },
            { icon: Star, title: "Accessible", desc: "ARIA-first and keyboard friendly." },
            { icon: Sparkles, title: "Polished", desc: "Micro-interactions and smooth motion." },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ y: 16, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-border p-5 bg-card">
              <div className="h-10 w-10 rounded-md bg-emerald-600/10 text-emerald-700 grid place-items-center mb-3">
                <f.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="bg-secondary/50 border-y border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">The problem</h2>
            <p className="text-muted-foreground mt-3">
              Educational content is often locked to a single language, leaving millions behind. Audio lessons and exercises are rarely localized.
            </p>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Our solution</h2>
            <p className="text-muted-foreground mt-3">
              LinguaLearn AI translates your materials, renders them as natural speech, and generates practice quizzes—all in your target language.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">Loved by students and educators</h2>
          <p className="text-muted-foreground mt-2">Real results from inclusive learning.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              quote: "I finally study physics in my own language—my grades shot up!",
              name: "Aisha",
              role: "Undergraduate, Morocco",
            },
            {
              quote: "Our ESL learners engage more with bilingual quizzes.",
              name: "Mr. Chen",
              role: "High school teacher, USA",
            },
            {
              quote: "Accessible UI and great TTS quality. Game changer.",
              name: "Lucía",
              role: "Grad student, Spain",
            },
          ].map((t) => (
            <motion.blockquote key={t.name} initial={{ y: 16, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="rounded-xl border border-border p-6 bg-card">
              <Quote className="h-5 w-5 text-amber-500" aria-hidden />
              <p className="mt-3">"{t.quote}"</p>
              <footer className="mt-4 text-sm text-muted-foreground">— {t.name}, {t.role}</footer>
            </motion.blockquote>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="mt-auto border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} LinguaLearn AI. Built for inclusive education.</p>
        </div>
      </footer>
    </div>
  );
}