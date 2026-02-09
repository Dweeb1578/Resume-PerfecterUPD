"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, Loader2, AlertTriangle, Lightbulb } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { ResumeData } from "@/types/resume";
import { SuggestedChanges, Suggestion } from "./SuggestedChanges";
import { QuestionCard, AnalysisQuestion, Severity } from "./QuestionCard";

interface ChatInterfaceProps {
    onResumeUpdate: (data: ResumeData) => void;
    resumeData?: ResumeData;
}

interface SeverityQuestions {
    critical: AnalysisQuestion[];
    warning: AnalysisQuestion[];
    niceToHave: AnalysisQuestion[];
}

export function ChatInterface({ onResumeUpdate, resumeData }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<any[]>([
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

    // Get current questions based on severity level, filtering out hidden experiences
    const analysisQuestions = allQuestions[currentSeverity].filter(q => {
        // If the question references an experience, check if it's hidden
        if (q.experienceId && resumeData?.experience) {
            const exp = resumeData.experience.find(e => e.id === q.experienceId);
            if (exp?.hidden) return false;
        }
        return true;
    });

    // Parse suggestion from message content
    const parseSuggestion = (content: string): { suggestion: Suggestion | null; textContent: string } => {
        // Look for JSON starting with {"type":"suggestion" - use a more robust approach
        const startIdx = content.indexOf('{"type":"suggestion"');
        if (startIdx !== -1) {
            // Find matching closing brace by counting braces
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

        // Try to find by experienceId first (stable reference after drag-drop)
        if (pendingSuggestion.experienceId) {
            const expIdx = updatedData.experience?.findIndex(e => e.id === pendingSuggestion.experienceId);
            if (expIdx !== undefined && expIdx >= 0) {
                const exp = updatedData.experience[expIdx];
                // Find bullet by original text (in case bullets were reordered)
                const bulletIdx = exp.bullets?.findIndex(b => b === pendingSuggestion.original);
                if (bulletIdx !== undefined && bulletIdx >= 0) {
                    exp.bullets[bulletIdx] = pendingSuggestion.suggested;
                    replaced = true;
                }
            }
        }

        // Fallback: try by experienceIndex and bulletIndex if ID lookup failed
        if (!replaced) {
            const expIdx = pendingSuggestion.experienceIndex ?? 0;
            const bulletIdx = pendingSuggestion.bulletIndex ?? 0;

            if (
                updatedData.experience &&
                updatedData.experience.length > expIdx &&
                updatedData.experience[expIdx].bullets &&
                updatedData.experience[expIdx].bullets.length > bulletIdx
            ) {
                updatedData.experience[expIdx].bullets[bulletIdx] = pendingSuggestion.suggested;
                replaced = true;
            }
        } else if (updatedData.experience && updatedData.experience.length > 0) {
            // Fallback: add to the first experience if indices are invalid
            updatedData.experience[0].bullets = [
                pendingSuggestion.suggested,
                ...(updatedData.experience[0].bullets || [])
            ];
        } else {
            // No experience exists - create one
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

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ... existing state ...

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            // 1. Parse Resume
            const res = await fetch("/api/parser", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Upload failed");
            }

            const data = await res.json();
            setUploadedData(data);
            setMode('selection'); // Switch to mode selection

        } catch (err: any) {
            console.error(err);
            alert(`Failed to parse resume: ${err.message || 'Unknown error'}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleModeSelect = async (selectedMode: 'edit' | 'rewrite' | 'rewrite-rag') => {
        if (!uploadedData) return;

        if (selectedMode === 'edit') {
            // Path A: Edit Original
            finalizeUpload(uploadedData);
        } else {
            // Path B or C: Rewrite with AI (standard or RAG-enhanced)
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
            } catch (err: any) {
                console.error("Rewrite error:", err);
                alert(`Failed to rewrite resume: ${err.message || 'Unknown error'}`);
                finalizeUpload(uploadedData);
            } finally {
                setIsRewriting(false);
            }
        }
    };

    const finalizeUpload = async (data: ResumeData) => {
        setMode('chat');
        onResumeUpdate(data);

        // 2. Active Analysis (Triggered after mode selection)
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

                // Stream the response to buffer
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                }

                // Parse the JSON response
                try {
                    // Clean up any markdown code fences and trailing commas
                    let cleanJson = result.replace(/```json\n?|\n?```/g, '').trim();
                    // Remove trailing commas before ] or } (common LLM mistake)
                    cleanJson = cleanJson.replace(/,\s*([}\]])/g, '$1');
                    const analysisData = JSON.parse(cleanJson);

                    // Extract intro message
                    if (analysisData.intro) {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: analysisData.intro
                        }]);
                    }

                    // Helper to add severity to questions
                    const addSeverity = (questions: any[], severity: Severity): AnalysisQuestion[] => {
                        return (questions || []).map((q: any) => {
                            const expIdx = q.experienceIndex ?? 0;
                            const bulletIdx = q.bulletIndex ?? 0;
                            const exp = data?.experience?.[expIdx];
                            return {
                                experienceIndex: expIdx,
                                bulletIndex: bulletIdx,
                                experienceId: exp?.id,  // Store stable ID
                                originalBullet: exp?.bullets?.[bulletIdx],  // Store original text
                                question: q.question,
                                issue: q.issue,
                                severity
                            };
                        });
                    };

                    // Extract questions by severity
                    const severityQuestions: SeverityQuestions = {
                        critical: addSeverity(analysisData.critical, 'critical'),
                        warning: addSeverity(analysisData.warning, 'warning'),
                        niceToHave: addSeverity(analysisData.niceToHave, 'niceToHave')
                    };

                    setAllQuestions(severityQuestions);
                    // Set initial severity to most severe available
                    if (severityQuestions.critical.length > 0) setCurrentSeverity('critical');
                    else if (severityQuestions.warning.length > 0) setCurrentSeverity('warning');
                    else if (severityQuestions.niceToHave.length > 0) setCurrentSeverity('niceToHave');
                    setAnsweredQuestions(new Set());

                    // Show count summary
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
                    // Fallback: show raw response as message
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

    // ... existing suggestion handlers ...

    if (mode === 'selection') {
        return (
            <div className="flex h-full flex-col bg-zinc-50 p-6 items-center justify-center">
                <div className="max-w-md w-full space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Resume Parsed!</h2>
                        <p className="text-zinc-600">How would you like to proceed?</p>
                    </div>

                    <div className="grid gap-4">
                        {/* Option 1: Edit Original */}
                        <button
                            onClick={() => handleModeSelect('edit')}
                            disabled={isRewriting}
                            className="bg-white p-6 rounded-xl border-2 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-zinc-100 rounded-lg group-hover:bg-zinc-200">
                                    <Paperclip className="h-5 w-5 text-zinc-600" />
                                </div>
                                <h3 className="font-semibold text-lg">Use Current Content</h3>
                            </div>
                            <p className="text-sm text-zinc-500">
                                Load your resume exactly as is. Best if you just want to fix formatting or headers.
                            </p>
                        </button>

                        {/* Option 2: AI Rewrite */}
                        <button
                            onClick={() => handleModeSelect('rewrite')}
                            disabled={isRewriting}
                            className="bg-white p-6 rounded-xl border-2 border-blue-500 hover:bg-blue-50 transition-all text-left group relative overflow-hidden"
                        >
                            {isRewriting && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                        <span className="text-sm font-medium text-blue-600">Rewriting your resume...</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-200">
                                    <Lightbulb className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-blue-700">Create Perfect Resume</h3>
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">RECOMMENDED</span>
                                </div>
                            </div>
                            <p className="text-sm text-zinc-600 mb-2">
                                AI will rewrite your bullets to be <strong>punchy, impactful, and professional</strong> using the STAR method.
                            </p>
                            <ul className="text-xs text-zinc-500 space-y-1 list-disc list-inside">
                                <li>Fixes grammar & tone</li>
                                <li>Adds strong action verbs</li>
                                <li>Structuring for readability</li>
                            </ul>
                        </button>

                        {/* Option 3: RAG-Enhanced Rewrite (Experimental) */}
                        <button
                            onClick={() => handleModeSelect('rewrite-rag')}
                            disabled={isRewriting}
                            className="bg-white p-4 rounded-xl border-2 border-purple-400 hover:bg-purple-50 transition-all text-left group relative overflow-hidden"
                        >
                            {isRewriting && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                                        <span className="text-sm font-medium text-purple-600">Searching examples & rewriting...</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-600 group-hover:bg-purple-200">
                                    <Lightbulb className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-purple-700">RAG-Enhanced Rewrite</h3>
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">EXPERIMENTAL</span>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500">
                                Uses vector search to find similar high-quality bullets as examples before rewriting.
                            </p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Handle answering a specific question
    const handleQuestionAnswer = async (answer: string, question: AnalysisQuestion) => {
        // Add user's answer to messages
        const userMessage = {
            id: Date.now().toString(),
            role: 'user' as const,
            content: answer
        };
        setMessages(prev => [...prev, userMessage]);

        // Mark question as answered - find the index to create matching key
        const questions = allQuestions[currentSeverity];
        const idx = questions.findIndex(q =>
            q.experienceIndex === question.experienceIndex &&
            q.bulletIndex === question.bulletIndex &&
            q.question === question.question
        );
        const questionKey = `${question.experienceIndex}-${question.bulletIndex}-${idx}`;
        setAnsweredQuestions(prev => new Set([...prev, questionKey]));

        // Get the original bullet text from resume data
        let originalBullet = "N/A";
        if (resumeData?.experience?.[question.experienceIndex]?.bullets?.[question.bulletIndex]) {
            originalBullet = resumeData.experience[question.experienceIndex].bullets[question.bulletIndex];
        }

        // Build context-aware message for the API with original bullet
        const contextMessage = {
            role: 'user' as const,
            content: `[Context: Enhancing Job #${question.experienceIndex + 1}, Bullet #${question.bulletIndex + 1}]

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
                body: JSON.stringify({
                    messages: [contextMessage]
                }),
            });

            if (!response.ok) {
                throw new Error("Chat API error");
            }

            const assistantMessageId = Date.now().toString();
            setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "" }]);

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let currentContent = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        // Check for suggestion in response
                        const { suggestion, textContent } = parseSuggestion(currentContent);
                        if (suggestion) {
                            // Override indices with the ones from the question
                            suggestion.experienceIndex = question.experienceIndex;
                            suggestion.bulletIndex = question.bulletIndex;
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

        const userMessage = { id: Date.now().toString(), role: 'user', content: safeInput };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Strip id field from messages - Groq only accepts role and content
            const apiMessages = [...messages, userMessage]
                .filter(m => m.role !== 'assistant' || m.content) // Skip empty assistant messages
                .map(({ role, content }) => ({ role, content }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: apiMessages }),
            });

            if (!response.ok) {
                console.error("Chat API error:", response.status);
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
                return;
            }

            const assistantMessageId = Date.now().toString();
            setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "" }]);

            // Try streaming first
            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let currentContent = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            // Stream complete - check for suggestions
                            const { suggestion, textContent } = parseSuggestion(currentContent);
                            if (suggestion) {
                                setPendingSuggestion(suggestion);
                                // Update message to show only text content
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
                    console.error("Stream error:", streamError);
                    // Fallback: try to get the response as text
                    if (!currentContent) {
                        const text = await response.text();
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMessageId ? { ...m, content: text } : m
                        ));
                    }
                }
            } else {
                // No streaming body, get text directly
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
        <div className="flex h-full flex-col bg-white border-r">
            {/* Header */}
            <div className="border-b p-4 flex items-center justify-between">
                <h2 className="font-semibold text-lg">AI Assistant</h2>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Paperclip className="h-4 w-4 mr-2" />}
                        {isUploading ? "Parsing..." : "Upload PDF"}
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 bg-zinc-50 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((m: any) => {
                        // Parse out JSON from display - use robust brace matching
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
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    p-3 rounded-lg max-w-[80%] text-sm shadow-sm break-words whitespace-pre-wrap
                                    ${m.role === 'user' ? 'bg-black text-white' : 'bg-white border text-black'}
                                `}>
                                    {displayContent || m.content}
                                </div>
                            </div>
                        );
                    })}

                    {/* Question Cards */}
                    {(allQuestions.critical.length > 0 || allQuestions.warning.length > 0 || allQuestions.niceToHave.length > 0) && (
                        <div className="space-y-3 mt-4">
                            {/* Analysis Tabs */}
                            <div className="flex p-1 bg-zinc-100 rounded-lg mb-4 gap-1">
                                {(['critical', 'warning', 'niceToHave'] as const).map(s => {
                                    const count = allQuestions[s].length;
                                    if (count === 0) return null;

                                    const isActive = currentSeverity === s;
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setCurrentSeverity(s)}
                                            className={`
                                            flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2
                                            ${isActive ? 'bg-white shadow text-black' : 'text-zinc-500 hover:bg-zinc-200'}
                                        `}
                                        >
                                            <span>
                                                {s === 'critical' && '🔴 Critical'}
                                                {s === 'warning' && '🟡 Warnings'}
                                                {s === 'niceToHave' && '🟢 Tips'}
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-zinc-100' : 'bg-zinc-300/50'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Question List */}
                            <div className="space-y-4">
                                {analysisQuestions.length === 0 ? (
                                    <div className="text-center py-8 text-zinc-500 text-sm">
                                        <p>No issues found in this category! 🎉</p>
                                    </div>
                                ) : (
                                    analysisQuestions.map((q, idx) => {
                                        const questionKey = `${q.experienceIndex}-${q.bulletIndex}-${idx}`;

                                        // Calculate dynamic label based on current resume state
                                        let contextLabel = "";
                                        if (resumeData?.experience) {
                                            // 1. Try finding by ID
                                            let currentExpIdx = -1;
                                            if (q.experienceId) {
                                                currentExpIdx = resumeData.experience.findIndex(e => e.id === q.experienceId);
                                            }

                                            // 2. Fallback to index if ID not found or not set
                                            if (currentExpIdx === -1) {
                                                currentExpIdx = q.experienceIndex;
                                            }

                                            // 3. Construct label if experience exists
                                            const exp = resumeData.experience[currentExpIdx];
                                            if (exp) {
                                                let currentBulletIdx = q.bulletIndex;
                                                // Try finding bullet by text
                                                if (q.originalBullet && exp.bullets) {
                                                    const bIdx = exp.bullets.indexOf(q.originalBullet);
                                                    if (bIdx !== -1) currentBulletIdx = bIdx;
                                                }

                                                const jobTitle = exp.role || exp.company || `Job #${currentExpIdx + 1}`;
                                                contextLabel = `${jobTitle}, Bullet #${currentBulletIdx + 1}`;
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
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border p-3 rounded-lg text-sm shadow-sm flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                            </div>
                        </div>
                    )}

                    {/* Floating Suggestion Card - only shown for free chat, not for question answers */}
                    {pendingSuggestion && analysisQuestions.length === 0 && (
                        <SuggestedChanges
                            suggestion={pendingSuggestion}
                            onApply={handleApplySuggestion}
                            onDismiss={handleDismissSuggestion}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <form
                onSubmit={handleSendMessage}
                className="border-t p-4 flex gap-2 bg-white"
            >
                <Input
                    placeholder="Ask me to improve a section..."
                    value={input || ""}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" size="icon" disabled={isLoading}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
}
