"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, Loader2, Sparkles } from "lucide-react";
import { ResumeData } from "@/types/resume";
import { SuggestedChanges, Suggestion } from "./SuggestedChanges";
import { QuestionCard, AnalysisQuestion, Severity } from "./QuestionCard";
import { motion, AnimatePresence } from "framer-motion";

interface ChatInterfaceProps {
    onResumeUpdate: (data: ResumeData) => void;
    resumeData?: ResumeData;
}

interface SeverityQuestions {
    critical: AnalysisQuestion[];
    warning: AnalysisQuestion[];
    niceToHave: AnalysisQuestion[];
}

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
}

export function ChatInterface({ onResumeUpdate, resumeData }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hello! Upload your resume PDF to verify the parser, or chat with me to build one.' }
    ]);
    const [input, setInput] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<Suggestion | null>(null);
    const [allQuestions, setAllQuestions] = useState<SeverityQuestions>({ critical: [], warning: [], niceToHave: [] });
    const [currentSeverity, setCurrentSeverity] = useState<Severity>('critical');
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [mode, setMode] = useState<'chat' | 'selection'>('chat');
    const [uploadedData, setUploadedData] = useState<ResumeData | null>(null);
    const [isRewriting, setIsRewriting] = useState(false);
    const [visibleQuestionCount, setVisibleQuestionCount] = useState(3);

    // Get current questions based on severity level, filtering out hidden items
    const analysisQuestions = useMemo(() => {
        return allQuestions[currentSeverity].filter(q => {
            if (q.section === 'experience' && q.experienceId && resumeData?.experience) {
                const item = resumeData.experience.find(e => e.id === q.experienceId);
                if (item?.hidden) return false;
            }
            if (q.section === 'project' && q.experienceId && resumeData?.projects) {
                const item = resumeData.projects.find(p => p.id === q.experienceId);
                if (item?.hidden) return false;
            }
            if (q.section === 'responsibility' && q.experienceId && resumeData?.responsibilities) {
                const item = resumeData.responsibilities.find(r => r.id === q.experienceId);
                if (item?.hidden) return false;
            }
            return true;
        });
    }, [allQuestions, currentSeverity, resumeData]);

    // Parse suggestion from message content
    const parseSuggestion = (content: string): { suggestion: Suggestion | null; textContent: string } => {
        const startIdx = content.indexOf('{"type":"suggestion"');
        if (startIdx !== -1) {
            let braceCount = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < content.length; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                if (braceCount === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
            const jsonStr = content.substring(startIdx, endIdx);
            try {
                const suggestion = JSON.parse(jsonStr) as Suggestion;
                const textContent = (content.substring(0, startIdx) + content.substring(endIdx)).trim();
                return { suggestion, textContent };
            } catch (e) {
                console.error('Failed to parse suggestion JSON:', e, jsonStr);
                return { suggestion: null, textContent: content };
            }
        }
        return { suggestion: null, textContent: content };
    };

    // Handle applying a suggestion
    const handleApplySuggestion = () => {
        if (!pendingSuggestion || !resumeData) return;

        const updatedData = JSON.parse(JSON.stringify(resumeData)) as ResumeData;
        let replaced = false;

        // Helper to update specific section
        const updateSection = (
            list: any[],
            id: string | undefined,
            idx: number | undefined,
            bulletIdx: number | undefined
        ) => {
            if (id) {
                const foundIdx = list.findIndex(e => e.id === id);
                if (foundIdx >= 0) {
                    const item = list[foundIdx];
                    const bIdx = item.bullets?.findIndex((b: string) => b === pendingSuggestion.original);
                    if (bIdx !== undefined && bIdx >= 0) {
                        item.bullets[bIdx] = pendingSuggestion.suggested;
                        return true;
                    }
                }
            }

            // Fallback to index if ID match failed
            const targetIdx = idx ?? 0;
            const targetBulletIdx = bulletIdx ?? 0;

            if (list.length > targetIdx && list[targetIdx].bullets && list[targetIdx].bullets.length > targetBulletIdx) {
                list[targetIdx].bullets[targetBulletIdx] = pendingSuggestion.suggested;
                return true;
            }
            return false;
        };

        if (pendingSuggestion.section === 'project') {
            replaced = updateSection(updatedData.projects || [], pendingSuggestion.experienceId, pendingSuggestion.projectIndex, pendingSuggestion.bulletIndex);
        } else if (pendingSuggestion.section === 'responsibility') {
            // Responsibilities use 'description', not 'bullets'
            if (pendingSuggestion.experienceId && updatedData.responsibilities) {
                const item = updatedData.responsibilities.find(r => r.id === pendingSuggestion.experienceId);
                if (item) {
                    item.description = pendingSuggestion.suggested;
                    replaced = true;
                }
            } else if (pendingSuggestion.responsibilityIndex !== undefined && updatedData.responsibilities && updatedData.responsibilities[pendingSuggestion.responsibilityIndex]) {
                updatedData.responsibilities[pendingSuggestion.responsibilityIndex].description = pendingSuggestion.suggested;
                replaced = true;
            }
        } else {
            // Default to experience
            replaced = updateSection(updatedData.experience || [], pendingSuggestion.experienceId, pendingSuggestion.experienceIndex, pendingSuggestion.bulletIndex);
        }

        if (!replaced && (!updatedData.experience || updatedData.experience.length === 0)) {
            // Fallback for empty resume
            updatedData.experience = [{
                id: Date.now().toString(),
                company: "Your Company",
                role: "Your Role",
                startDate: "",
                endDate: "Present",
                location: "",
                bullets: [pendingSuggestion.suggested]
            }];
        }

        onResumeUpdate(updatedData);
        setPendingSuggestion(null);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: replaced
                ? '✅ Replaced the bullet point!'
                : '✅ Added new bullet to your resume.'
        }]);
    };

    const handleDismissSuggestion = () => {
        setPendingSuggestion(null);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/parser", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                let errorMsg = "Upload failed";
                try {
                    const errorData = await res.json();
                    errorMsg = errorData.error ? `${errorData.error}${errorData.details ? ': ' + errorData.details : ''}` : "Upload failed";
                } catch {
                    // Non-JSON response (likely 500/504 HTML from Vercel)
                    errorMsg = `Upload failed (${res.status} ${res.statusText})`;
                }
                throw new Error(errorMsg);
            }

            const data = await res.json();
            setUploadedData(data);
            setMode('selection');

        } catch (err: unknown) {
            console.error(err);
            alert(`Failed to parse resume: ${(err as Error).message || 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleModeSelect = async (selectedMode: 'edit' | 'rewrite' | 'rewrite-rag') => {
        if (!uploadedData) return;

        if (selectedMode === 'edit') {
            finalizeUpload(uploadedData);
        } else {
            setIsRewriting(true);
            const endpoint = selectedMode === 'rewrite-rag' ? "/api/rewrite-rag" : "/api/rewrite";
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(uploadedData),
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.details || "Rewriting failed");
                }
                const rewrittenData = await res.json();
                finalizeUpload(rewrittenData);
            } catch (err: unknown) {
                console.error("Rewrite error:", err);
                alert(`Failed to rewrite resume: ${(err as Error).message || 'Unknown error'}`);
                finalizeUpload(uploadedData);
            } finally {
                setIsRewriting(false);
            }
        }
    };

    const finalizeUpload = async (data: ResumeData) => {
        setMode('chat');
        onResumeUpdate(data);

        try {
            const analyzeRes = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (analyzeRes.body) {
                const reader = analyzeRes.body.getReader();
                const decoder = new TextDecoder();
                let result = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                }

                try {
                    let cleanJson = result.replace(/```json\n?|\n?```/g, '').trim();
                    cleanJson = cleanJson.replace(/,\s*([}\]])/g, '$1');
                    const analysisData = JSON.parse(cleanJson);

                    if (analysisData.intro) {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: analysisData.intro
                        }]);
                    }

                    const addSeverity = (questions: unknown[], severity: Severity): AnalysisQuestion[] => {
                        return (questions || []).map((q: unknown) => {
                            const question = q as AnalysisQuestion & { id?: string };

                            // DEBUG: Log raw question from analyzer
                            console.log('📋 Raw analyzer question:', JSON.stringify({
                                section: question.section,
                                id: question.id,
                                quote: (question.quote || '').substring(0, 50),
                                bulletIndex: question.bulletIndex,
                            }));

                            // 1. Normalize section name from LLM (handle plural variants)
                            let rawSection = (question.section || 'experience') as string;
                            if (rawSection === 'projects') rawSection = 'project';
                            if (rawSection === 'responsibilities') rawSection = 'responsibility';
                            let section = rawSection as 'experience' | 'project' | 'responsibility';
                            const llmSection = section; // Save the LLM's section hint
                            let itemId = question.id || question.experienceId;
                            let originalBullet: string | undefined;

                            // Indices - resolve from ID if possible
                            let expIdx = question.experienceIndex;
                            let projIdx = question.projectIndex;
                            let respIdx = question.responsibilityIndex;
                            const bulletIdx = question.bulletIndex ?? 0;

                            // 2. GLOBAL ID SEARCH - highest confidence
                            let idResolved = false;
                            if (itemId && itemId !== 'uuid') {
                                // Try Projects
                                if (data?.projects) {
                                    const projectsIdx = data.projects.findIndex(p => p.id === itemId);
                                    if (projectsIdx >= 0) {
                                        section = 'project';
                                        projIdx = projectsIdx;
                                        originalBullet = data.projects[projectsIdx].bullets?.[bulletIdx];
                                        idResolved = true;
                                    }
                                }
                                // Try Responsibilities
                                if (!idResolved && data?.responsibilities) {
                                    const responsibilitiesIdx = data.responsibilities.findIndex(r => r.id === itemId);
                                    if (responsibilitiesIdx >= 0) {
                                        section = 'responsibility';
                                        respIdx = responsibilitiesIdx;
                                        const item = data.responsibilities[responsibilitiesIdx];
                                        originalBullet = item.description || item.bullets?.[bulletIdx];
                                        idResolved = true;
                                    }
                                }
                                // Try Experience
                                if (!idResolved && data?.experience) {
                                    const experienceIdx = data.experience.findIndex(e => e.id === itemId);
                                    if (experienceIdx >= 0) {
                                        section = 'experience';
                                        expIdx = experienceIdx;
                                        originalBullet = data.experience[experienceIdx].bullets?.[bulletIdx];
                                        idResolved = true;
                                    }
                                }
                                console.log(idResolved ? `✅ ID lookup found: section=${section}` : `⚠️ ID lookup failed for: ${itemId}`);
                            }

                            // 3. QUOTE SEARCH - fallback if ID failed
                            const questionAny = question as any;
                            if (!originalBullet && questionAny.quote) {
                                const quote = questionAny.quote.toLowerCase().slice(0, 30);

                                // Search Projects
                                data?.projects?.forEach((p, pIdx) => {
                                    p.bullets?.forEach((b) => {
                                        if (b.toLowerCase().includes(quote)) {
                                            section = 'project';
                                            projIdx = pIdx;
                                            itemId = p.id;
                                            originalBullet = b;
                                        }
                                    });
                                });

                                // Search Responsibilities
                                if (!originalBullet) {
                                    data?.responsibilities?.forEach((r, rIdx) => {
                                        if (r.description && r.description.toLowerCase().includes(quote)) {
                                            section = 'responsibility';
                                            respIdx = rIdx;
                                            itemId = r.id;
                                            originalBullet = r.description;
                                        }
                                        if (!originalBullet && r.bullets) {
                                            r.bullets.forEach((b: string) => {
                                                if (b.toLowerCase().includes(quote)) {
                                                    section = 'responsibility';
                                                    respIdx = rIdx;
                                                    itemId = r.id;
                                                    originalBullet = b;
                                                }
                                            });
                                        }
                                    });
                                }

                                // Search Experience
                                if (!originalBullet) {
                                    data?.experience?.forEach((e, eIdx) => {
                                        e.bullets?.forEach((b) => {
                                            if (b.toLowerCase().includes(quote)) {
                                                section = 'experience';
                                                expIdx = eIdx;
                                                itemId = e.id;
                                                originalBullet = b;
                                            }
                                        });
                                    });
                                }

                                if (originalBullet) {
                                    console.log(`✅ Quote lookup found: section=${section}`);
                                } else {
                                    console.warn(`⚠️ Quote lookup failed for: "${quote}..."`);
                                }
                            } else if (!originalBullet) {
                                // 4. INDEX FALLBACK - use LLM section to guide index lookup
                                if (llmSection === 'project' && data?.projects?.length) {
                                    section = 'project';
                                    projIdx = projIdx ?? 0;
                                    const item = data.projects[projIdx];
                                    itemId = item?.id;
                                    originalBullet = item?.bullets?.[bulletIdx];
                                } else if (llmSection === 'responsibility' && data?.responsibilities?.length) {
                                    section = 'responsibility';
                                    respIdx = respIdx ?? 0;
                                    const item = data.responsibilities[respIdx];
                                    itemId = item?.id;
                                    originalBullet = item?.description || item?.bullets?.[bulletIdx];
                                } else if (data?.experience?.length) {
                                    section = 'experience';
                                    expIdx = expIdx ?? 0;
                                    const item = data.experience[expIdx];
                                    itemId = item?.id;
                                    originalBullet = item?.bullets?.[bulletIdx];
                                }
                            }

                            // 5. LAST RESORT: Even if we couldn't find the bullet, trust the LLM section
                            if (!idResolved && !originalBullet) {
                                section = llmSection;
                            }

                            if (!originalBullet) {
                                console.warn("❌ Could not find original bullet!", {
                                    section, itemId, llmSection,
                                    question: (question.question || '').substring(0, 50)
                                });
                            }

                            // Generate a unique ID for the question itself
                            const questionId = `q-${section}-${itemId || 'noid'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                            return {
                                ...question,
                                id: questionId,
                                section,
                                experienceIndex: expIdx,
                                projectIndex: projIdx,
                                responsibilityIndex: respIdx,
                                experienceId: itemId,
                                originalBullet,
                                severity
                            };
                        });
                    };

                    const severityQuestions: SeverityQuestions = {
                        critical: addSeverity(analysisData.critical, 'critical'),
                        warning: addSeverity(analysisData.warning, 'warning'),
                        niceToHave: addSeverity(analysisData.niceToHave, 'niceToHave')
                    };

                    setAllQuestions(severityQuestions);
                    if (severityQuestions.critical.length > 0) setCurrentSeverity('critical');
                    else if (severityQuestions.warning.length > 0) setCurrentSeverity('warning');
                    else if (severityQuestions.niceToHave.length > 0) setCurrentSeverity('niceToHave');
                    setAnsweredQuestions(new Set());
                    setVisibleQuestionCount(3); // Reset pagination

                    const criticalCount = severityQuestions.critical.length;
                    const warningCount = severityQuestions.warning.length;
                    const niceCount = severityQuestions.niceToHave.length;

                    if (criticalCount > 0) {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString() + '-summary',
                            role: 'assistant',
                            content: `Found ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}, ${warningCount} warning${warningCount > 1 ? 's' : ''}, and ${niceCount} nice-to-have${niceCount > 1 ? 's' : ''}. Let's fix the critical ones first!`
                        }]);
                    }
                } catch (parseError) {
                    console.error("Failed to parse analysis JSON:", parseError);
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: result
                    }]);
                }
            }

        } catch (err) {
            console.error(err);
        }
    };

    if (mode === 'selection') {
        return (
            <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-900 p-6 items-center justify-center">
                <div className="max-w-md w-full space-y-6">
                    <div className="text-center">
                        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2">Resume Parsed!</motion.h2>
                        <p className="text-zinc-600 dark:text-zinc-400">How would you like to proceed?</p>
                    </div>

                    <div className="grid gap-4">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleModeSelect('rewrite')}
                            disabled={isRewriting}
                            className="bg-white dark:bg-zinc-800 p-6 rounded-xl border-2 border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all text-left group relative overflow-hidden shadow-md"
                        >
                            {isRewriting && (
                                <div className="absolute inset-0 bg-white/80 dark:bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                        <span className="text-sm font-medium text-indigo-600">Rewriting your resume...</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 group-hover:bg-indigo-200">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-indigo-700 dark:text-indigo-400">Create Perfect Resume</h3>
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full">RECOMMENDED</span>
                                </div>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">
                                AI will rewrite your bullets to be <strong>punchy, impactful, and professional</strong> using the STAR method.
                            </p>
                        </motion.button>
                    </div>
                </div>
            </div>
        );
    }

    const handleQuestionAnswer = async (answer: string, question: AnalysisQuestion) => {
        const userMessage = { id: Date.now().toString(), role: 'user' as const, content: answer };
        setMessages(prev => [...prev, userMessage]);

        // Track answered question by ID
        setAnsweredQuestions(prev => new Set([...prev, question.id]));

        let originalBullet = question.originalBullet || "N/A";
        let contextHeader = "";

        if (question.section === 'project') {
            contextHeader = `Project Job #${(question.projectIndex ?? 0) + 1}, Bullet #${(question.bulletIndex ?? 0) + 1}`;
        } else if (question.section === 'responsibility') {
            contextHeader = `Responsibility #${(question.responsibilityIndex ?? 0) + 1}`;
        } else {
            contextHeader = `Job #${(question.experienceIndex ?? 0) + 1}, Bullet #${(question.bulletIndex ?? 0) + 1}`;
        }

        const contextMessage = {
            role: 'user' as const,
            content: `[Context: Enhancing ${contextHeader}]

ORIGINAL BULLET (must preserve core content):
"${originalBullet}"

Question asked: "${question.question}"
User's additional context: "${answer}"

TASK: Enhance the ORIGINAL BULLET using the user's context. Keep the original achievement/action, add the metrics/details from the user's answer.`
        };

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: [contextMessage] }),
            });

            if (!response.ok) throw new Error("Chat API error");

            const assistantMessageId = Date.now().toString();
            setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "" }]);

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let currentContent = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        const { suggestion, textContent } = parseSuggestion(currentContent);
                        if (suggestion) {
                            suggestion.section = question.section;
                            suggestion.experienceIndex = question.experienceIndex;
                            suggestion.projectIndex = question.projectIndex;
                            suggestion.responsibilityIndex = question.responsibilityIndex;
                            suggestion.bulletIndex = question.bulletIndex;
                            suggestion.experienceId = question.experienceId;
                            suggestion.sourceQuestionId = question.id; // STRICT LINKING

                            setPendingSuggestion(suggestion);
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMessageId ? { ...m, content: textContent || "I have a suggestion:" } : m
                            ));
                        }
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    currentContent += chunk;

                    setMessages(prev => prev.map(m =>
                        m.id === assistantMessageId ? { ...m, content: currentContent } : m
                    ));
                }
            }
        } catch (error) {
            console.error("Error answering question:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "Sorry, something went wrong. Please try again."
            }]);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const safeInput = input || "";
        if (!safeInput.trim() || isLoading) return;

        const userMessage: Message = { id: Date.now().toString(), role: 'user', content: safeInput };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const apiMessages = [...messages, userMessage]
                .filter(m => m.role !== 'assistant' || m.content)
                .map(({ role, content }) => ({ role, content }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: apiMessages }),
            });

            if (!response.ok) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
                return;
            }

            const assistantMessageId = Date.now().toString();
            setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "" }]);

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let currentContent = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            const { suggestion, textContent } = parseSuggestion(currentContent);
                            if (suggestion) {
                                setPendingSuggestion(suggestion);
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMessageId ? { ...m, content: textContent || "I have a suggestion for you:" } : m
                                ));
                            }
                            break;
                        }

                        const chunk = decoder.decode(value, { stream: true });
                        currentContent += chunk;

                        setMessages(prev => prev.map(m =>
                            m.id === assistantMessageId ? { ...m, content: currentContent } : m
                        ));
                    }
                } catch (streamError) {
                    const text = await response.text();
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMessageId ? { ...m, content: text } : m
                    ));
                }
            } else {
                const text = await response.text();
                setMessages(prev => prev.map(m =>
                    m.id === assistantMessageId ? { ...m, content: text } : m
                ));
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Sorry, something went wrong." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
            {/* Header */}
            <div className="border-b border-sidebar-border p-4 flex items-center justify-between bg-sidebar/50 backdrop-blur-sm sticky top-0 z-10">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    AI Assistant
                </h2>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <PremiumButton
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-xs h-8"
                    >
                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />}
                        {isUploading ? "Parsing..." : "Import PDF"}
                    </PremiumButton>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 scroll-smooth">
                {messages.map((m: Message) => {
                    let displayContent = m.content;
                    const startIdx = displayContent.indexOf('{"type":"suggestion"');
                    if (startIdx !== -1) {
                        let braceCount = 0;
                        let endIdx = startIdx;
                        for (let i = startIdx; i < displayContent.length; i++) {
                            if (displayContent[i] === '{') braceCount++;
                            if (displayContent[i] === '}') braceCount--;
                            if (braceCount === 0) {
                                endIdx = i + 1;
                                break;
                            }
                        }
                        displayContent = (displayContent.substring(0, startIdx) + displayContent.substring(endIdx)).trim();
                    }
                    if (!displayContent && m.role === 'assistant') return null;

                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={m.id}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`
                                p-4 rounded-2xl max-w-[85%] text-sm shadow-sm break-words whitespace-pre-wrap
                                ${m.role === 'user'
                                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-none'
                                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-none'
                                }
                            `}>
                                {displayContent || m.content}
                            </div>
                        </motion.div>
                    );
                })}

                {/* Analysis UI */}
                {(allQuestions.critical.length > 0 || allQuestions.warning.length > 0 || allQuestions.niceToHave.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3 mt-4"
                    >
                        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-4 gap-1">
                            {(['critical', 'warning', 'niceToHave'] as const).map(s => {
                                const count = allQuestions[s].length;
                                if (count === 0) return null;
                                const isActive = currentSeverity === s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => { setCurrentSeverity(s); setVisibleQuestionCount(3); }}
                                        className={`
                                        flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2
                                        ${isActive ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700/50'}
                                    `}
                                    >
                                        <span>
                                            {s === 'critical' && 'Critical'}
                                            {s === 'warning' && 'Warnings'}
                                            {s === 'niceToHave' && 'Tips'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-zinc-100 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentSeverity}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-4"
                            >
                                {analysisQuestions.length === 0 ? (
                                    <div className="text-center py-8 text-zinc-500 text-sm flex flex-col items-center">
                                        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                                            <Sparkles className="h-6 w-6 text-green-500" />
                                        </div>
                                        <p>No issues found! Great job. 🎉</p>
                                    </div>
                                ) : (
                                    <>
                                        {analysisQuestions.slice(0, visibleQuestionCount).map((q, idx) => {
                                            // Use the unique ID generated in addSeverity
                                            const questionKey = q.id;

                                            let contextLabel = "";
                                            if (q.section === 'project' && resumeData?.projects) {
                                                const proj = resumeData.projects[q.projectIndex ?? 0];
                                                if (proj) {
                                                    contextLabel = `${proj.name} • Bullet #${(q.bulletIndex ?? 0) + 1}`;
                                                }
                                            } else if (q.section === 'responsibility' && resumeData?.responsibilities) {
                                                const resp = resumeData.responsibilities[q.responsibilityIndex ?? 0];
                                                if (resp) {
                                                    contextLabel = `${resp.title || resp.organization} • Description`;
                                                }
                                            } else if (resumeData?.experience) {
                                                const exp = resumeData.experience[q.experienceIndex ?? 0];
                                                if (exp) {
                                                    const jobTitle = exp.role || exp.company || "Job";
                                                    contextLabel = `${jobTitle} • Bullet #${(q.bulletIndex ?? 0) + 1}`;
                                                }
                                            }

                                            return (
                                                <QuestionCard
                                                    key={questionKey}
                                                    question={q}
                                                    questionNumber={idx + 1}
                                                    onSubmit={handleQuestionAnswer}
                                                    isAnswered={answeredQuestions.has(questionKey)}
                                                    pendingSuggestion={pendingSuggestion}
                                                    onApplySuggestion={handleApplySuggestion}
                                                    onDismissSuggestion={handleDismissSuggestion}
                                                    contextLabel={contextLabel}
                                                />
                                            );
                                        })}
                                        {visibleQuestionCount < analysisQuestions.length && (
                                            <button
                                                onClick={() => setVisibleQuestionCount(prev => prev + 3)}
                                                className="w-full py-2.5 px-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                                            >
                                                Show More ({analysisQuestions.length - visibleQuestionCount} remaining)
                                            </button>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-zinc-800 border dark:border-zinc-700 p-3 rounded-lg text-sm shadow-sm flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                            <span className="text-zinc-500">Thinking...</span>
                        </div>
                    </div>
                )}

                {pendingSuggestion && analysisQuestions.length === 0 && (
                    <SuggestedChanges
                        suggestion={pendingSuggestion}
                        onApply={handleApplySuggestion}
                        onDismiss={handleDismissSuggestion}
                    />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={handleSendMessage}
                className="border-t border-sidebar-border p-4 flex gap-2 bg-sidebar"
            >
                <Input
                    placeholder="Ask AI to help..."
                    value={input || ""}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-indigo-500"
                />
                <PremiumButton type="submit" size="icon" disabled={isLoading} variant="premium" className="shrink-0">
                    <Send className="h-4 w-4" />
                </PremiumButton>
            </form>
        </div>
    );
}
