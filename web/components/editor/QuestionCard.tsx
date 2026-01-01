"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, AlertCircle, AlertTriangle, Lightbulb, Check, X, Sparkles } from "lucide-react";
import { useState } from "react";

export type Severity = 'critical' | 'warning' | 'niceToHave';

export interface AnalysisQuestion {
    experienceIndex: number;
    bulletIndex: number;
    question: string;
    issue?: string;
    severity?: Severity;
}

export interface Suggestion {
    type: "suggestion";
    experienceIndex?: number;
    bulletIndex?: number;
    original: string;
    suggested: string;
    reasoning: string;
}

interface QuestionCardProps {
    question: AnalysisQuestion;
    questionNumber: number;
    onSubmit: (answer: string, question: AnalysisQuestion) => Promise<void>;
    isAnswered: boolean;
    pendingSuggestion?: Suggestion | null;
    onApplySuggestion?: () => void;
    onDismissSuggestion?: () => void;
}

const severityConfig = {
    critical: {
        icon: AlertCircle,
        label: "Critical",
        bg: "from-red-50 to-rose-50",
        border: "border-red-300",
        badge: "bg-red-100 text-red-700",
        iconColor: "text-red-600"
    },
    warning: {
        icon: AlertTriangle,
        label: "Warning",
        bg: "from-amber-50 to-yellow-50",
        border: "border-amber-300",
        badge: "bg-amber-100 text-amber-700",
        iconColor: "text-amber-600"
    },
    niceToHave: {
        icon: Lightbulb,
        label: "Nice to Have",
        bg: "from-green-50 to-emerald-50",
        border: "border-green-300",
        badge: "bg-green-100 text-green-700",
        iconColor: "text-green-600"
    }
};

export function QuestionCard({
    question,
    questionNumber,
    onSubmit,
    isAnswered,
    pendingSuggestion,
    onApplySuggestion,
    onDismissSuggestion
}: QuestionCardProps) {
    const [answer, setAnswer] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const severity = question.severity || 'critical';
    const config = severityConfig[severity];
    const SeverityIcon = config.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!answer.trim() || isLoading) return;

        setIsLoading(true);
        try {
            await onSubmit(answer, question);
            setAnswer("");
        } finally {
            setIsLoading(false);
        }
    };

    // Check if this question has a pending suggestion
    const hasSuggestion = pendingSuggestion &&
        pendingSuggestion.experienceIndex === question.experienceIndex &&
        pendingSuggestion.bulletIndex === question.bulletIndex;

    // Answered with suggestion - show the suggestion card inline
    if (isAnswered && hasSuggestion) {
        return (
            <div className="space-y-3">
                {/* Answered question header */}
                <div className={`bg-gradient-to-r ${config.bg} ${config.border} border rounded-lg p-3 opacity-60`}>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-500">✓</span>
                        <span className={config.badge + " px-2 py-0.5 rounded text-xs font-medium"}>
                            {config.label}
                        </span>
                        <span className="text-zinc-500">Question {questionNumber} answered</span>
                    </div>
                </div>

                {/* Inline Suggestion Card */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="bg-purple-100 p-1.5 rounded-lg">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-sm font-semibold text-purple-700">Suggested Improvement</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">Before</div>
                            <p className="text-sm text-red-700 line-through opacity-70">
                                {pendingSuggestion.original}
                            </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="text-[10px] uppercase tracking-wider text-green-500 font-semibold mb-1">After</div>
                            <p className="text-sm text-green-700 font-medium">
                                {pendingSuggestion.suggested}
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-500 italic mb-3">
                        💡 {pendingSuggestion.reasoning}
                    </p>

                    <div className="flex gap-2">
                        <Button
                            onClick={onApplySuggestion}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            Apply Change
                        </Button>
                        <Button
                            onClick={onDismissSuggestion}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-zinc-300 hover:bg-zinc-100"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Dismiss
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Just answered, no suggestion yet (or suggestion dismissed)
    if (isAnswered) {
        return (
            <div className={`bg-gradient-to-r ${config.bg} ${config.border} border rounded-lg p-3 opacity-50`}>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span className={config.badge + " px-2 py-0.5 rounded text-xs font-medium"}>
                        {config.label}
                    </span>
                    <span className="line-through text-zinc-500">{question.question}</span>
                </div>
            </div>
        );
    }

    // Not answered yet - show input
    return (
        <div className={`bg-gradient-to-r ${config.bg} ${config.border} border rounded-xl p-4 shadow-sm`}>
            <div className="flex items-start gap-2 mb-3">
                <div className={`${config.badge} p-1.5 rounded-lg shrink-0`}>
                    <SeverityIcon className={`h-4 w-4 ${config.iconColor}`} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={config.badge + " px-2 py-0.5 rounded text-xs font-medium"}>
                            {config.label}
                        </span>
                        <span className="text-xs text-zinc-400">
                            Job #{question.experienceIndex + 1}, Bullet #{question.bulletIndex + 1}
                        </span>
                    </div>
                    <p className="text-sm text-zinc-800">
                        {question.question}
                    </p>
                    {question.issue && (
                        <p className="text-xs text-zinc-500 mt-1 italic">
                            Issue: {question.issue}
                        </p>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                    placeholder="Type your answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 bg-white"
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !answer.trim()}
                    className={severity === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                        severity === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                            'bg-green-600 hover:bg-green-700'}
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </form>
        </div>
    );
}
