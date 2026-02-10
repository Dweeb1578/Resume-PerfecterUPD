"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/editor/ChatInterface";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { SectionManager } from "@/components/editor/SectionManager";
import { initialResumeState, ResumeData } from "@/types/resume";

export default function ResumeBuilderPage() {
    const [resumeData, setResumeData] = useState<ResumeData>(initialResumeState);

    // Check if resume has actual content
    const hasContent = resumeData.experience?.length > 0 ||
        resumeData.projects?.length > 0 ||
        resumeData.education?.length > 0;

    return (
        <div className="h-screen w-full overflow-hidden bg-background flex">
            {/* Left Panel: Chat / Editor */}
            <div className="w-[30%] min-w-[320px] border-r border-sidebar-border bg-sidebar flex flex-col z-10 shadow-sm">
                <ChatInterface onResumeUpdate={setResumeData} resumeData={resumeData} />
            </div>

            {/* Middle Panel: Preview */}
            <div className="flex-1 bg-zinc-50/50 dark:bg-black/20 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-25 dark:opacity-10 pointer-events-none" />
                <ResumePreview data={resumeData} onResumeUpdate={setResumeData} />
            </div>

            {/* Right Panel: Section Manager (only shown when there's content) */}
            {hasContent && (
                <div className="w-[280px] min-w-[250px] border-l border-sidebar-border bg-white dark:bg-zinc-900 flex flex-col z-10 shadow-sm">
                    <SectionManager data={resumeData} onUpdate={setResumeData} />
                </div>
            )}
        </div>
    );
}
