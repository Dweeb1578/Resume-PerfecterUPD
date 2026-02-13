"use client";

import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";

export interface Suggestion {
    type: "suggestion";
    experienceIndex?: number;
    projectIndex?: number;
    responsibilityIndex?: number;
    bulletIndex?: number;
    experienceId?: string;  // Stable ID for lookup after reordering
    sourceQuestionId?: string; // Strict link to the question that generated this suggestion
    section?: 'experience' | 'project' | 'responsibility';
    original: string;
    suggested: string;
    reasoning: string;
}

interface SuggestedChangesProps {
    suggestion: Suggestion;
    onApply: () => void;
    onDismiss: () => void;
}

export function SuggestedChanges({ suggestion, onApply, onDismiss }: SuggestedChangesProps) {
    return (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-purple-100 p-1.5 rounded-lg">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-purple-700">Suggested Improvement</span>
                <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">
                    {suggestion.section}
                </span>
            </div>

            {/* Side-by-side diff */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Original */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">Before</div>
                    <p className="text-sm text-red-700 line-through opacity-70">
                        {suggestion.original}
                    </p>
                </div>

                {/* Suggested */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-green-500 font-semibold mb-1">After</div>
                    <p className="text-sm text-green-700 font-medium">
                        {suggestion.suggested}
                    </p>
                </div>
            </div>

            {/* Reasoning */}
            <p className="text-xs text-zinc-500 italic mb-3">
                💡 {suggestion.reasoning}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <Button
                    onClick={onApply}
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                    <Check className="h-4 w-4 mr-1" />
                    Apply Change
                </Button>
                <Button
                    onClick={onDismiss}
                    size="sm"
                    variant="outline"
                    className="flex-1 border-zinc-300 hover:bg-zinc-100"
                >
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                </Button>
            </div>
        </div>
    );
}
