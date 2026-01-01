"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/editor/ChatInterface";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { initialResumeState, ResumeData } from "@/types/resume";

export default function ResumeBuilderPage() {
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeState);

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex">
      {/* Left Panel: Chat / Editor */}
      <div className="w-[35%] min-w-[350px] border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <ChatInterface onResumeUpdate={setResumeData} resumeData={resumeData} />
      </div>

      {/* Right Panel: Preview */}
      <div className="flex-1 bg-zinc-100 overflow-hidden">
        <ResumePreview data={resumeData} onResumeUpdate={setResumeData} />
      </div>
    </div>
  );
}
