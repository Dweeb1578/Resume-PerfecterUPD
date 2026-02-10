"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle, PremiumCardDescription } from "@/components/ui/PremiumCard";
import { ArrowRight, Sparkles, FileText, Bot, Zap, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center overflow-x-hidden">

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] dark:opacity-[0.05]" />
      </div>

      {/* Navbar */}
      <nav className="w-full max-w-7xl px-6 py-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
            RP
          </div>
          <span className="font-bold text-xl tracking-tight">Resume Perfecter</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link href="/editor">
            <PremiumButton size="sm" variant="glass">
              Launch Editor
            </PremiumButton>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        className="w-full max-w-7xl px-6 pt-20 pb-32 flex flex-col items-center text-center z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-secondary mb-8 backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span className="text-xs font-medium text-secondary-foreground">AI-Powered Resume Optimization</span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl text-balance">
          Craft Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">Perfect Resume</span> in Minutes
        </motion.h1>

        <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 text-balance">
          Leverage advanced AI to rewrite, format, and optimize your resume for your dream job. Stand out from the crowd with premium designs.
        </motion.p>

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center">
          <Link href="/editor">
            <PremiumButton size="lg" className="text-lg px-8 h-12 shadow-xl shadow-indigo-500/20">
              Build My Resume <ArrowRight className="ml-2 h-5 w-5" />
            </PremiumButton>
          </Link>
          <Link href="#features">
            <PremiumButton size="lg" variant="ghost" className="text-lg px-8 h-12">
              See How It Works
            </PremiumButton>
          </Link>
        </motion.div>

        {/* Hero Visual */}
        <motion.div
          variants={itemVariants}
          className="mt-20 relative w-full max-w-5xl aspect-[16/9] rounded-xl border border-white/10 shadow-2xl overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 to-zinc-800 opacity-90" />
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Abstract UI representation */}
            <div className="w-[90%] h-[85%] bg-background rounded-lg shadow-2xl border border-white/5 flex overflow-hidden">
              <div className="w-[28%] border-r border-border bg-sidebar/50 backdrop-blur p-4 space-y-3">
                <div className="h-8 w-24 bg-primary/10 rounded-md animate-pulse" />
                <div className="space-y-2 pt-4">
                  <div className="h-12 w-full bg-secondary/50 rounded-lg" />
                  <div className="h-12 w-full bg-secondary/30 rounded-lg" />
                  <div className="h-12 w-full bg-secondary/30 rounded-lg" />
                </div>
              </div>
              <div className="flex-1 p-8 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="w-full h-full bg-white dark:bg-zinc-900 shadow-sm border border-border/50 rounded flex flex-col p-8 space-y-4">
                  <div className="w-32 h-8 bg-zinc-200 dark:bg-zinc-800 rounded self-center" />
                  <div className="w-full h-px bg-border my-2" />
                  <div className="space-y-2">
                    <div className="w-full h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
                    <div className="w-[90%] h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
                    <div className="w-[95%] h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="w-full max-w-7xl px-6 py-24 z-10">
        <div className="grid md:grid-cols-3 gap-8">
          <PremiumCard className="hover:border-indigo-500/50 transition-colors">
            <PremiumCardHeader>
              <Bot className="h-10 w-10 text-indigo-500 mb-4" />
              <PremiumCardTitle>AI Optimization</PremiumCardTitle>
              <PremiumCardDescription>
                Smart algorithms analyze and rewrite your bullet points for maximum impact.
              </PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Keyphrase integration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Grammar perfection
                </li>
              </ul>
            </PremiumCardContent>
          </PremiumCard>

          <PremiumCard className="hover:border-purple-500/50 transition-colors">
            <PremiumCardHeader>
              <Zap className="h-10 w-10 text-purple-500 mb-4" />
              <PremiumCardTitle>Instant Formatting</PremiumCardTitle>
              <PremiumCardDescription>
                Switch between professional templates instantly without re-typing a single word.
              </PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> ATS-friendly layouts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> One-click PDF export
                </li>
              </ul>
            </PremiumCardContent>
          </PremiumCard>

          <PremiumCard className="hover:border-pink-500/50 transition-colors">
            <PremiumCardHeader>
              <FileText className="h-10 w-10 text-pink-500 mb-4" />
              <PremiumCardTitle>Content Parsing</PremiumCardTitle>
              <PremiumCardDescription>
                Upload your existing resume and let our parser extract the details for you.
              </PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> PDF & Word support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Smart section detection
                </li>
              </ul>
            </PremiumCardContent>
          </PremiumCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/40 py-12 px-6 bg-background/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-bold">RP</div>
            <p className="text-sm font-medium">© 2026 Resume Perfecter</p>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
