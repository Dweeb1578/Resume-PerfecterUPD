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

    // Get current questions based on severity level
    const analysisQuestions = allQuestions[currentSeverity];

    // Parse suggestion from message content
    const parseSuggestion = (content: string): { suggestion: Suggestion | null; textContent: string } => {
        const jsonMatch = content.match(/\{"type":"suggestion"[^}]+\}/g);
        if (jsonMatch) {
            try {
                const suggestion = JSON.parse(jsonMatch[0]) as Suggestion;
                const textContent = content.replace(jsonMatch[0], '').trim();
                return { suggestion, textContent };
            } catch (e) {
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

        // Use the indices provided by the AI (if available)
        const expIdx = pendingSuggestion.experienceIndex ?? 0;
        const bulletIdx = pendingSuggestion.bulletIndex ?? 0;

        // Check if the indices are valid
        if (
            updatedData.experience &&
            updatedData.experience.length > expIdx &&
            updatedData.experience[expIdx].bullets &&
            updatedData.experience[expIdx].bullets.length > bulletIdx
        ) {
            // Replace the specific bullet
            updatedData.experience[expIdx].bullets[bulletIdx] = pendingSuggestion.suggested;
            replaced = true;
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

            if (!res.ok) throw new Error("Parse failed");

            const data = await res.json();
            onResumeUpdate(data);

            // 2. Active Analysis
            const analyzeRes = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeData: data }),
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
                        return (questions || []).map((q: any) => ({
                            experienceIndex: q.experienceIndex ?? 0,
                            bulletIndex: q.bulletIndex ?? 0,
                            question: q.question,
                            issue: q.issue,
                            severity
                        }));
                    };

                    // Extract questions by severity
                    const severityQuestions: SeverityQuestions = {
                        critical: addSeverity(analysisData.critical, 'critical'),
                        warning: addSeverity(analysisData.warning, 'warning'),
                        niceToHave: addSeverity(analysisData.niceToHave, 'niceToHave')
                    };

                    setAllQuestions(severityQuestions);
                    setCurrentSeverity('critical');
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
            alert("Failed to parse resume PDF.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Handle answering a specific question
    const handleQuestionAnswer = async (answer: string, question: AnalysisQuestion) => {
        // Add user's answer to messages
        const userMessage = {
            id: Date.now().toString(),
            role: 'user' as const,
            content: answer
        };
        setMessages(prev => [...prev, userMessage]);

        // Mark question as answered
        const questionKey = `${question.experienceIndex}-${question.bulletIndex}`;
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
                        // Parse out JSON from display
                        const displayContent = m.content.replace(/\{"type":"suggestion"[^}]+\}/g, '').trim();
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
                    {analysisQuestions.length > 0 && (
                        <div className="space-y-3 mt-4">
                            {/* Severity Header */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-semibold px-2 py-1 rounded ${currentSeverity === 'critical' ? 'bg-red-100 text-red-700' :
                                        currentSeverity === 'warning' ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
                                    }`}>
                                    {currentSeverity === 'critical' ? '🔴 Critical Issues' :
                                        currentSeverity === 'warning' ? '🟡 Warnings' :
                                            '🟢 Nice to Have'}
                                </span>
                                <span className="text-xs text-zinc-400">
                                    {analysisQuestions.length} item{analysisQuestions.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            {analysisQuestions.map((q, idx) => {
                                const questionKey = `${q.experienceIndex}-${q.bulletIndex}`;
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
                                    />
                                );
                            })}

                            {/* Show next severity level button */}
                            {currentSeverity === 'critical' && allQuestions.warning.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => setCurrentSeverity('warning')}
                                >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Show {allQuestions.warning.length} Warning{allQuestions.warning.length > 1 ? 's' : ''}
                                </Button>
                            )}

                            {currentSeverity === 'warning' && allQuestions.niceToHave.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                                    onClick={() => setCurrentSeverity('niceToHave')}
                                >
                                    <Lightbulb className="h-4 w-4 mr-2" />
                                    Show {allQuestions.niceToHave.length} Nice-to-Have{allQuestions.niceToHave.length > 1 ? 's' : ''}
                                </Button>
                            )}

                            {/* Back button for lower severity levels */}
                            {currentSeverity !== 'critical' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-zinc-500"
                                    onClick={() => setCurrentSeverity(currentSeverity === 'niceToHave' ? 'warning' : 'critical')}
                                >
                                    ← Back to {currentSeverity === 'niceToHave' ? 'Warnings' : 'Critical'}
                                </Button>
                            )}
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
