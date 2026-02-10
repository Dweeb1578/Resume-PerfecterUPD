"use client";

import { ResumeData, SectionType } from "@/types/resume";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, Minus, Plus, RotateCcw, GripVertical, MoveVertical } from "lucide-react";
import { Reorder } from "framer-motion";

import { Button } from "@/components/ui/button";
import { EditableText } from "./EditableText";
import { cn } from "@/lib/utils";

interface ResumePreviewProps {
    data: ResumeData;
    onResumeUpdate?: (data: ResumeData) => void;
}

// A4 dimensions in px at 96dpi
const A4_HEIGHT_PX = 1123;

interface BulletToRemove {
    experienceIndex: number;
    bulletIndex: number;
    text: string;
    reason: string;
}

interface ExperienceToRemove {
    experienceIndex: number;
    role: string;
    company: string;
    reason: string;
    score: number;
}

// Utility to highlight metrics and skill keywords in bullet text
function highlightMetrics(text: string, skills: string[] = []): React.ReactNode {
    if (!text) return text;

    const skillsEscaped = skills
        .filter(s => s && s.length > 1)
        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    const metricsPatternStr = `\\d+%|\\$[\\d,]+[KMB]?|\\d+[xX]|\\d+\\+`;
    const patternParts = [metricsPatternStr];
    if (skillsEscaped) {
        patternParts.push(`\\b(?:${skillsEscaped})\\b`);
    }

    const combinedPattern = new RegExp(`(${patternParts.join('|')})`, 'gi');
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    combinedPattern.lastIndex = 0;

    while ((match = combinedPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push(text.slice(lastIndex, match.index));
        }
        result.push(<strong key={match.index} className="font-semibold">{match[0]}</strong>);
        lastIndex = combinedPattern.lastIndex;
    }

    if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
    }

    return result.length > 0 ? result : text;
}

// Rank bullets by "removability"
function findBulletsToRemove(data: ResumeData, targetReduction: number): BulletToRemove[] {
    const candidates: Array<BulletToRemove & { score: number }> = [];
    const strongVerbs = /^(Led|Built|Designed|Increased|Reduced|Launched|Managed|Created|Developed|Implemented|Achieved|Grew|Generated|Drove|Spearheaded|Optimized|Secured|Negotiated)/i;
    const weakVerbs = /^(Helped|Assisted|Worked|Participated|Supported|Contributed|Involved|Attended|Learned|Observed)/i;
    const hasMetrics = /\d+%|\d+x|\$[\d,]+|\d+\s*(users|customers|hours|days|weeks|months|people|teams|projects|clients|members|employees)/i;

    (data.experience || []).forEach((exp, expIdx) => {
        if ((exp.bullets?.length || 0) > 1) {
            exp.bullets?.forEach((bullet, bulletIdx) => {
                let score = 0;
                let reason = '';

                if (bulletIdx === 0) score += 40;
                score -= (expIdx * 5);
                if (bulletIdx > 3) {
                    score -= 10;
                    reason = reason || 'Job has many bullets';
                }

                if (hasMetrics.test(bullet)) {
                    score += 50;
                } else {
                    if (bulletIdx !== 0) reason = reason || 'No metrics or quantifiable results';
                }

                if (strongVerbs.test(bullet)) score += 30;
                if (weakVerbs.test(bullet)) {
                    score -= 20;
                    reason = reason || 'Uses weak action verb';
                }
                if (/various|multiple|different|several|many|some/i.test(bullet)) {
                    score -= 15;
                    reason = reason || 'Contains vague language';
                }
                if (bullet.length < 50) {
                    score -= 10;
                    reason = reason || 'Too brief';
                }

                if (!reason) {
                    if (score < 0) reason = 'Less impactful than other bullets';
                    else reason = 'Consider condensing';
                }

                candidates.push({
                    experienceIndex: expIdx,
                    bulletIndex: bulletIdx,
                    text: bullet.substring(0, 80) + (bullet.length > 80 ? '...' : ''),
                    reason,
                    score
                });
            });
        }
    });

    candidates.sort((a, b) => a.score - b.score);
    const bulletsNeeded = Math.ceil(targetReduction / 50);
    return candidates.slice(0, Math.min(bulletsNeeded, candidates.length));
}

function findWeakExperiences(data: ResumeData): ExperienceToRemove[] {
    const candidates: ExperienceToRemove[] = [];
    const strongVerbs = /^(Led|Built|Designed|Increased|Reduced|Launched|Managed|Created|Developed|Implemented|Achieved|Grew|Generated|Drove|Spearheaded|Optimized|Secured|Negotiated)/i;
    const hasMetrics = /\d+%|\d+x|\$[\d,]+|\d+\s*(users|customers|hours|days|weeks|months|people|teams|projects|clients|members|employees)/i;

    (data.experience || []).forEach((exp, expIdx) => {
        let score = 0;
        let reason = '';
        const bullets = exp.bullets || [];

        if (bullets.length <= 1) {
            score -= 20;
            reason = 'Only 1 bullet point';
        } else if (bullets.length === 2) {
            score -= 10;
            reason = 'Only 2 bullet points';
        } else {
            score += bullets.length * 5;
        }

        if (bullets.some(b => hasMetrics.test(b))) score += 30;
        else {
            score -= 15;
            reason = reason || 'No quantifiable metrics';
        }

        if (bullets.some(b => strongVerbs.test(b))) score += 20;
        else {
            score -= 10;
            reason = reason || 'Missing strong action verbs';
        }

        score -= expIdx * 8;

        const bigCompanies = /google|amazon|microsoft|meta|facebook|apple|netflix|tesla|nvidia|adobe|salesforce|oracle|ibm|intel/i;
        if (bigCompanies.test(exp.company)) score += 50;

        if (/intern/i.test(exp.role) && expIdx > 1) {
            score -= 15;
            reason = reason || 'Older internship';
        }

        if (score < 20) {
            candidates.push({
                experienceIndex: expIdx,
                role: exp.role,
                company: exp.company,
                reason: reason || 'Weaker than other experiences',
                score
            });
        }
    });

    candidates.sort((a, b) => a.score - b.score);
    return candidates;
}

export function ResumePreview({ data, onResumeUpdate }: ResumePreviewProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const [bulletsToRemove, setBulletsToRemove] = useState<BulletToRemove[]>([]);
    const [experiencesToRemove, setExperiencesToRemove] = useState<ExperienceToRemove[]>([]);
    const [fontScale, setFontScale] = useState(1);
    const [titleScale, setTitleScale] = useState(1);
    const [previousData, setPreviousData] = useState<ResumeData | null>(null);
    const [previousFontScale, setPreviousFontScale] = useState<number | null>(null);
    const [isReordering, setIsReordering] = useState(false);

    const baseFontSize = 10.8;
    const currentFontSize = baseFontSize * fontScale;

    useEffect(() => {
        if (contentRef.current) {
            const height = contentRef.current.scrollHeight;
            setContentHeight(height);
            const overflow = height > A4_HEIGHT_PX + 60;
            setIsOverflowing(overflow);

            if (overflow) {
                const reduction = height - A4_HEIGHT_PX;
                setBulletsToRemove(findBulletsToRemove(data, reduction));
            } else {
                setBulletsToRemove([]);
            }
            setExperiencesToRemove(findWeakExperiences(data));
        }
    }, [data, fontScale, titleScale]);

    const handleUpdateProfile = (field: keyof typeof data.profile, value: string) => {
        if (!onResumeUpdate) return;
        onResumeUpdate({
            ...data,
            profile: { ...data.profile, [field]: value }
        });
    };

    const handleUpdateSectionTitle = (section: SectionType, title: string) => {
        if (!onResumeUpdate) return;
        onResumeUpdate({
            ...data,
            sectionTitles: { ...(data.sectionTitles || {}), [section]: title }
        });
    };

    const handleSectionReorder = (newOrder: SectionType[]) => {
        if (!onResumeUpdate) return;
        if (JSON.stringify(newOrder) !== JSON.stringify(data.sectionOrder)) {
            onResumeUpdate({ ...data, sectionOrder: newOrder });
        }
    };

    const updateExperience = (index: number, field: string, value: any) => {
        if (!onResumeUpdate) return;
        const newExp = [...(data.experience || [])];
        newExp[index] = { ...newExp[index], [field]: value };
        onResumeUpdate({ ...data, experience: newExp });
    };

    const updateExperienceBullet = (expIndex: number, bulletIndex: number, value: string) => {
        if (!onResumeUpdate) return;
        const newExp = [...(data.experience || [])];
        const newBullets = [...(newExp[expIndex].bullets || [])];
        newBullets[bulletIndex] = value;
        newExp[expIndex] = { ...newExp[expIndex], bullets: newBullets };
        onResumeUpdate({ ...data, experience: newExp });
    };

    const updateResponsibility = (index: number, field: string, value: any) => {
        if (!onResumeUpdate) return;
        const newResp = [...(data.responsibilities || [])];
        newResp[index] = { ...newResp[index], [field]: value };
        onResumeUpdate({ ...data, responsibilities: newResp });
    };

    const updateAchievement = (index: number, value: string) => {
        if (!onResumeUpdate) return;
        const newAch = [...(data.achievements || [])];
        newAch[index] = value;
        onResumeUpdate({ ...data, achievements: newAch });
    };

    const updateEducation = (index: number, field: string, value: any) => {
        if (!onResumeUpdate) return;
        const newEdu = [...(data.education || [])];
        newEdu[index] = { ...newEdu[index], [field]: value };
        onResumeUpdate({ ...data, education: newEdu });
    };

    const updateProject = (index: number, field: string, value: any) => {
        if (!onResumeUpdate) return;
        const newProj = [...(data.projects || [])];
        newProj[index] = { ...newProj[index], [field]: value };
        onResumeUpdate({ ...data, projects: newProj });
    };

    const updateProjectBullet = (projIndex: number, bulletIndex: number, value: string) => {
        if (!onResumeUpdate) return;
        const newProj = [...(data.projects || [])];
        const newBullets = [...(newProj[projIndex].bullets || [])];
        newBullets[bulletIndex] = value;
        newProj[projIndex] = { ...newProj[projIndex], bullets: newBullets };
        onResumeUpdate({ ...data, projects: newProj });
    };

    const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
        if (!onResumeUpdate) return;
        setPreviousData(JSON.parse(JSON.stringify(data)));
        setPreviousFontScale(fontScale);
        const updatedData = JSON.parse(JSON.stringify(data)) as ResumeData;
        if (updatedData.experience && updatedData.experience[expIdx]?.bullets) {
            updatedData.experience[expIdx].bullets.splice(bulletIdx, 1);
            onResumeUpdate(updatedData);
        }
    };

    const handleAutoRemoveWeak = () => {
        if (!onResumeUpdate || bulletsToRemove.length === 0) return;
        setPreviousData(JSON.parse(JSON.stringify(data)));
        setPreviousFontScale(fontScale);
        const updatedData = JSON.parse(JSON.stringify(data)) as ResumeData;
        const sortedRemovals = [...bulletsToRemove].sort((a, b) => {
            if (a.experienceIndex !== b.experienceIndex) return b.experienceIndex - a.experienceIndex;
            return b.bulletIndex - a.bulletIndex;
        });
        sortedRemovals.forEach(bullet => {
            if (updatedData.experience && updatedData.experience[bullet.experienceIndex]?.bullets) {
                updatedData.experience[bullet.experienceIndex].bullets.splice(bullet.bulletIndex, 1);
            }
        });
        onResumeUpdate(updatedData);
    };

    const handleRemoveExperience = (expIdx: number) => {
        if (!onResumeUpdate) return;
        setPreviousData(JSON.parse(JSON.stringify(data)));
        setPreviousFontScale(fontScale);
        const updatedData = JSON.parse(JSON.stringify(data)) as ResumeData;
        if (updatedData.experience && updatedData.experience.length > expIdx) {
            updatedData.experience.splice(expIdx, 1);
            onResumeUpdate(updatedData);
        }
    };

    const handleShrinkFont = () => {
        setPreviousFontScale(fontScale);
        setPreviousData(null);
        setFontScale(prev => Math.max(0.8, prev - 0.05));
    };

    const handleReset = () => {
        setFontScale(1);
        setPreviousData(null);
        setPreviousFontScale(null);
    };

    return (
        <div className="flex h-full w-full bg-zinc-200">
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="mx-auto max-w-[210mm] mb-4 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 bg-white rounded-md p-1 shadow-sm border">
                        <Button
                            variant={isReordering ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setIsReordering(!isReordering)}
                            className={cn("gap-2", isReordering && "bg-blue-50 text-blue-700")}
                        >
                            <MoveVertical className="h-4 w-4" />
                            {isReordering ? "Done Reordering" : "Reorder Sections"}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-md p-1 shadow-sm border">
                        <span className="text-[10px] text-zinc-500 px-1">Text</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleShrinkFont} disabled={fontScale <= 0.8}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-medium w-10 text-center text-zinc-600">{Math.round(fontScale * 100)}%</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFontScale(prev => Math.min(1.2, prev + 0.05))} disabled={fontScale >= 1.2}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => window.print()}>
                        Export PDF
                    </Button>
                </div>

                {isOverflowing && (
                    <div className="mx-auto max-w-[210mm] mb-4 bg-red-50 border border-red-300 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">Resume exceeds one page</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" className="bg-red-600 text-white" onClick={handleAutoRemoveWeak} disabled={bulletsToRemove.length === 0}>
                                Remove {bulletsToRemove.length} Weak Points
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleShrinkFont} disabled={fontScale <= 0.8}>
                                Shrink Font
                            </Button>
                        </div>
                    </div>
                )}

                <div className="mx-auto max-w-[210mm] relative">
                    <div
                        id="resume-preview-content"
                        ref={contentRef}
                        className="w-full bg-white shadow-xl text-black font-serif"
                        style={{
                            minHeight: '297mm',
                            padding: '12mm 15mm',
                            fontSize: `${currentFontSize}pt`,
                            lineHeight: '1.35',
                        }}
                    >
                        {/* Header */}
                        <div className="text-center mb-1 group relative">
                            <EditableText
                                value={data.profile.name}
                                onChange={(val) => handleUpdateProfile('name', val)}
                                tagName="h1"
                                className="text-[1.8em] font-bold tracking-wide leading-tight inline-block min-w-[100px]"
                                placeholder="Your Name"
                            />
                            <div className="flex justify-center items-center gap-2 text-[0.85em] text-zinc-700 mt-0.5 flex-wrap">
                                <EditableText value={data.profile.phone} onChange={(val) => handleUpdateProfile('phone', val)} placeholder="Phone" />
                                <span className="text-zinc-400">|</span>
                                <EditableText value={data.profile.email} onChange={(val) => handleUpdateProfile('email', val)} placeholder="Email" />
                            </div>
                        </div>

                        {/* Drag and Drop Sections */}
                        <Reorder.Group axis="y" values={data.sectionOrder || ['education', 'experience', 'responsibilities', 'projects', 'achievements', 'skills']} onReorder={handleSectionReorder}>
                            {(data.sectionOrder || ['education', 'experience', 'responsibilities', 'projects', 'achievements', 'skills']).map((section) => (
                                <Reorder.Item key={section} value={section} dragListener={isReordering}>
                                    <div className={cn("relative group/section transition-colors rounded-sm", isReordering && "hover:bg-blue-50/50 cursor-grab active:cursor-grabbing border border-transparent hover:border-blue-200")}>
                                        {isReordering && (
                                            <div className="absolute -left-6 top-2 text-zinc-300 hover:text-zinc-500 flex items-center justify-center h-6 w-6">
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                        )}

                                        {/* Section Content */}
                                        {section === 'education' && data.education?.length > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Education"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                {(data.education || []).filter(edu => !edu.hidden).map((edu, idx) => (
                                                    <div key={idx} className="mb-0.5">
                                                        <div className="flex justify-between">
                                                            <EditableText value={edu.school} onChange={(val) => updateEducation(idx, 'school', val)} className="font-bold" placeholder="University Name" />
                                                            <div className="text-[0.85em] flex gap-1">
                                                                <EditableText value={edu.startDate || ''} onChange={(val) => updateEducation(idx, 'startDate', val)} placeholder="MMM YYYY" />
                                                                <span className="mx-1">–</span>
                                                                <EditableText value={edu.endDate || ''} onChange={(val) => updateEducation(idx, 'endDate', val)} placeholder="MMM YYYY" />
                                                            </div>
                                                        </div>
                                                        <div className="text-[0.85em] italic text-zinc-600 flex gap-1">
                                                            <EditableText value={edu.degree} onChange={(val) => updateEducation(idx, 'degree', val)} placeholder="Degree" />
                                                            <span>in</span>
                                                            <EditableText value={edu.field} onChange={(val) => updateEducation(idx, 'field', val)} placeholder="Major" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {section === 'experience' && data.experience?.length > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Professional Experience"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                {(data.experience || []).filter(exp => !exp.hidden).map((exp, idx) => (
                                                    <div key={idx} className="mb-1.5">
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <EditableText value={exp.role} onChange={(val) => updateExperience(idx, 'role', val)} className="font-bold" style={{ fontSize: `${titleScale}em` }} placeholder="Job Title" />
                                                            <div className="text-[0.85em] flex gap-1">
                                                                <EditableText value={exp.startDate || ''} onChange={(val) => updateExperience(idx, 'startDate', val)} placeholder="MMM YYYY" />
                                                                <span className="mx-1">–</span>
                                                                <EditableText value={exp.endDate || ''} onChange={(val) => updateExperience(idx, 'endDate', val)} placeholder="MMM YYYY" />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between text-[0.85em] mb-0.5">
                                                            <EditableText value={exp.company} onChange={(val) => updateExperience(idx, 'company', val)} className="font-semibold italic text-zinc-600" placeholder="Company Name" />
                                                            <EditableText value={exp.location} onChange={(val) => updateExperience(idx, 'location', val)} className="text-zinc-500" placeholder="City, Country" />
                                                        </div>
                                                        <ul className="ml-4 space-y-0 text-justify">
                                                            {exp.bullets?.map((bullet, bulletIdx) => (
                                                                <li key={bulletIdx} className="text-[0.9em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                                    <EditableText
                                                                        value={bullet}
                                                                        onChange={(val) => updateExperienceBullet(idx, bulletIdx, val)}
                                                                        renderPreview={(val) => highlightMetrics(val, data.skills)}
                                                                        multiline={true}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {section === 'responsibilities' && data.responsibilities?.length > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Positions of Responsibility"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                {(data.responsibilities || []).filter(resp => !resp.hidden).map((resp, idx) => (
                                                    <div key={idx} className="mb-1">
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <EditableText value={resp.title} onChange={(val) => updateResponsibility(idx, 'title', val)} className="font-bold" style={{ fontSize: `${titleScale}em` }} placeholder="Role Title" />
                                                            <div className="text-[0.85em] flex gap-1">
                                                                <EditableText value={resp.startDate || ''} onChange={(val) => updateResponsibility(idx, 'startDate', val)} placeholder="MMM YYYY" />
                                                                <span className="mx-1">–</span>
                                                                <EditableText value={resp.endDate || ''} onChange={(val) => updateResponsibility(idx, 'endDate', val)} placeholder="MMM YYYY" />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between text-[0.85em] mb-0.5">
                                                            <EditableText value={resp.organization} onChange={(val) => updateResponsibility(idx, 'organization', val)} className="italic text-zinc-600" placeholder="Organization" />
                                                            <EditableText value={resp.location} onChange={(val) => updateResponsibility(idx, 'location', val)} className="text-zinc-500" placeholder="Location" />
                                                        </div>
                                                        <ul className="ml-4 space-y-0 text-justify">
                                                            <li className="text-[0.9em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                                <EditableText
                                                                    value={resp.description}
                                                                    onChange={(val) => updateResponsibility(idx, 'description', val)}
                                                                    renderPreview={(val) => highlightMetrics(val, data.skills)}
                                                                    multiline={true}
                                                                />
                                                            </li>
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {section === 'achievements' && (data.achievements?.length ?? 0) > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Achievements & Certifications"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                <ul className="ml-4 space-y-0">
                                                    {(data.achievements || []).map((achievement, idx) => (
                                                        <li key={idx} className="text-[0.9em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                            <EditableText
                                                                value={achievement}
                                                                onChange={(val) => updateAchievement(idx, val)}
                                                                renderPreview={(val) => highlightMetrics(val, data.skills)}
                                                                multiline={true}
                                                            />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {section === 'projects' && data.projects?.length > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Projects"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                {(data.projects || []).filter(proj => !proj.hidden).map((proj, idx) => (
                                                    <div key={idx} className="mb-1">
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <EditableText value={proj.name} onChange={(val) => updateProject(idx, 'name', val)} className="font-bold" style={{ fontSize: `${titleScale}em` }} placeholder="Project Name" />
                                                            {proj.link && <a href={proj.link} className="text-blue-700 text-[0.85em] hover:underline">[Link]</a>}
                                                        </div>
                                                        {proj.technologies?.length > 0 && (
                                                            <div className="text-[0.85em] text-zinc-600 mb-0.5">
                                                                {proj.technologies.map((tech, tIdx) => (
                                                                    <span key={tIdx}>{tIdx > 0 && ", "}<EditableText value={tech} onChange={(val) => {
                                                                        const newTech = [...proj.technologies];
                                                                        newTech[tIdx] = val;
                                                                        updateProject(idx, 'technologies', newTech);
                                                                    }} placeholder="Tech" /></span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <ul className="ml-4 space-y-0 text-justify">
                                                            {proj.bullets?.map((bullet, bulletIdx) => (
                                                                <li key={bulletIdx} className="text-[0.9em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                                    <EditableText
                                                                        value={bullet}
                                                                        onChange={(val) => updateProjectBullet(idx, bulletIdx, val)}
                                                                        renderPreview={(val) => highlightMetrics(val, data.skills)}
                                                                        multiline={true}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {section === 'skills' && data.skills?.length > 0 && (
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 border-b border-zinc-300 pb-0.5 mb-1">
                                                    <EditableText
                                                        value={data.sectionTitles?.[section] || "Skills"}
                                                        onChange={(val) => handleUpdateSectionTitle(section, val)}
                                                        tagName="h2"
                                                        className="text-[0.95em] font-bold text-blue-800 uppercase tracking-wider"
                                                    />
                                                </div>
                                                <div className="text-[0.9em]">
                                                    <span className="font-semibold">Technical:</span>
                                                    {data.skills.map((skill, sIdx) => (
                                                        <span key={sIdx}>{sIdx > 0 && ", "}<EditableText value={skill} onChange={(val) => {
                                                            const newSkills = [...data.skills];
                                                            newSkills[sIdx] = val;
                                                            if (onResumeUpdate) onResumeUpdate({ ...data, skills: newSkills });
                                                        }} placeholder="Skill" /></span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>

                        {/* Page Break */}
                        {isOverflowing && (
                            <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-10" style={{ top: '297mm' }}>
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded whitespace-nowrap">
                                    ✂️ Page 1 ends here
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
