import React from 'react';
import { ResumePreview } from '@/components/editor/ResumePreview';
import { ResumeData } from '@/types/resume';

export default function TestPreviewSafety() {
    // Malformed data simulating parser failure (missing arrays)
    const malformedData: any = {
        profile: {
            name: "Test User",
            email: "test@example.com",
            phone: "123-456-7890",
        },
        // Missing experience, education, projects, etc.
        skills: ["React", "TypeScript"]
    };

    return (
        <div className="h-screen w-full bg-zinc-100 p-8">
            <h1 className="text-2xl font-bold mb-4">Resume Preview Crash Test</h1>
            <p className="mb-8">If you see the preview below, the crash fix is working.</p>
            <div className="border border-zinc-300 shadow-lg h-[800px]">
                <ResumePreview data={malformedData as ResumeData} />
            </div>
        </div>
    );
}
