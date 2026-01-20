"use client";

import { ResumeData, ResumeExperience } from "@/types/resume";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

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

// Utility to highlight metrics and skill keywords in bullet text
function highlightMetrics(text: string, skills: string[] = []): React.ReactNode {
    if (!text) return text;

    // Build skills pattern from the resume's own skills
    const skillsEscaped = skills
        .filter(s => s && s.length > 1)
        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    // Metrics: percentages, dollar amounts, numbers with units (only match meaningful numbers)
    const metricsPatternStr = `\\d+%|\\$[\\d,]+[KMB]?|\\d+[xX]|\\d+\\+`;

    // Combine patterns
    const patternParts = [metricsPatternStr];
    if (skillsEscaped) {
        patternParts.push(`\\b(?:${skillsEscaped})\\b`);
    }

    const combinedPattern = new RegExp(`(${patternParts.join('|')})`, 'gi');

    // Use replace approach to build React elements
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Reset lastIndex for safety
    combinedPattern.lastIndex = 0;

    while ((match = combinedPattern.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            result.push(text.slice(lastIndex, match.index));
        }
        // Add the highlighted match
        result.push(<strong key={match.index} className="font-semibold">{match[0]}</strong>);
        lastIndex = combinedPattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
    }

    return result.length > 0 ? result : text;
}

// Rank bullets by "removability" - WEAK bullets (no metrics, weak verbs) first
function findBulletsToRemove(data: ResumeData, targetReduction: number): BulletToRemove[] {
    const candidates: Array<BulletToRemove & { score: number }> = [];

    // Strong action verbs that indicate valuable content
    const strongVerbs = /^(Led|Built|Designed|Increased|Reduced|Launched|Managed|Created|Developed|Implemented|Achieved|Grew|Generated|Drove|Spearheaded|Optimized|Secured|Negotiated)/i;

    // Weak action verbs that indicate less impactful content
    const weakVerbs = /^(Helped|Assisted|Worked|Participated|Supported|Contributed|Involved|Attended|Learned|Observed)/i;

    // Metrics patterns indicate strong bullets
    const hasMetrics = /\d+%|\d+x|\$[\d,]+|\d+\s*(users|customers|hours|days|weeks|months|people|teams|projects|clients|members|employees)/i;

    data.experience?.forEach((exp, expIdx) => {
        // Only consider removal if job has more than 1 bullet
        if ((exp.bullets?.length || 0) > 1) {
            exp.bullets?.forEach((bullet, bulletIdx) => {
                // Score bullets - HIGHER score = STRONGER bullet = KEEP
                // LOWER score = WEAKER bullet = REMOVE FIRST
                let score = 0;
                let reason = '';

                // 1. Critical Rule: Protect the first bullet of every job (+40)
                if (bulletIdx === 0) {
                    score += 40;
                }

                // 2. Bias: Remove from older jobs first (-5 per job index)
                score -= (expIdx * 5);

                // 3. Bias: Remove later bullets in a list (-10 if it's the 4th, 5th, etc.)
                if (bulletIdx > 3) {
                    score -= 10;
                    reason = reason || 'Job has many bullets, consider consolidating';
                }

                // Has numbers/metrics = very valuable (+50)
                if (hasMetrics.test(bullet)) {
                    score += 50;
                } else {
                    // Only penalize for lacking metrics if it's NOT the first bullet
                    // (First bullets often describe the role generally)
                    if (bulletIdx !== 0) {
                        reason = reason || 'No metrics or quantifiable results';
                    }
                }

                // Strong action verbs = valuable (+30)
                if (strongVerbs.test(bullet)) {
                    score += 30;
                }

                // Weak action verbs = less valuable (-20)
                if (weakVerbs.test(bullet)) {
                    score -= 20;
                    reason = reason || 'Uses weak action verb (helped, assisted, etc.)';
                }

                // Vague words indicate weak bullets (-15)
                if (/various|multiple|different|several|many|some/i.test(bullet)) {
                    score -= 15;
                    reason = reason || 'Contains vague language';
                }

                // Very short bullets might lack detail
                if (bullet.length < 50) {
                    score -= 10;
                    reason = reason || 'Too brief, lacks detail';
                }

                // Default reason
                if (!reason) {
                    if (score < 0) reason = 'Less impactful than other bullets';
                    else reason = 'Consider condensing this point';
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

    // Sort by score ASCENDING - lowest score (weakest bullets) first
    candidates.sort((a, b) => a.score - b.score);

    // Return only what's needed to fit
    const bulletsNeeded = Math.ceil(targetReduction / 50); // ~50px per bullet
    return candidates.slice(0, Math.min(bulletsNeeded, candidates.length));
}

export function ResumePreview({ data, onResumeUpdate }: ResumePreviewProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const [bulletsToRemove, setBulletsToRemove] = useState<BulletToRemove[]>([]);
    const [fontScale, setFontScale] = useState(0.9); // 0.9 = default (slightly smaller), 1 = 100%
    const [previousData, setPreviousData] = useState<ResumeData | null>(null);
    const [previousFontScale, setPreviousFontScale] = useState<number | null>(null);

    const baseFontSize = 13.5; // pt
    const currentFontSize = baseFontSize * fontScale;

    // Check if content exceeds one page
    useEffect(() => {
        if (contentRef.current) {
            const height = contentRef.current.scrollHeight;
            setContentHeight(height);
            // Add 60px tolerance to prevent false overflow warnings for borderline cases
            // (Browser rendering differences, sub-pixel rounding, etc.)
            const overflow = height > A4_HEIGHT_PX + 60;
            setIsOverflowing(overflow);

            if (overflow) {
                const reduction = height - A4_HEIGHT_PX;
                setBulletsToRemove(findBulletsToRemove(data, reduction));
            } else {
                setBulletsToRemove([]);
            }
        }
    }, [data, fontScale]);

    const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
        if (!onResumeUpdate) return;
        setPreviousData(JSON.parse(JSON.stringify(data)));
        setPreviousFontScale(fontScale);

        const updatedData = JSON.parse(JSON.stringify(data)) as ResumeData;
        if (updatedData.experience[expIdx]?.bullets) {
            updatedData.experience[expIdx].bullets.splice(bulletIdx, 1);
            onResumeUpdate(updatedData);
        }
    };

    const handleAutoRemoveWeak = () => {
        if (!onResumeUpdate || bulletsToRemove.length === 0) return;
        setPreviousData(JSON.parse(JSON.stringify(data)));
        setPreviousFontScale(fontScale);

        const updatedData = JSON.parse(JSON.stringify(data)) as ResumeData;

        // Sort by experience then bullet index descending to avoid index shifting issues
        const sortedRemovals = [...bulletsToRemove].sort((a, b) => {
            if (a.experienceIndex !== b.experienceIndex) return b.experienceIndex - a.experienceIndex;
            return b.bulletIndex - a.bulletIndex;
        });

        sortedRemovals.forEach(bullet => {
            if (updatedData.experience[bullet.experienceIndex]?.bullets) {
                updatedData.experience[bullet.experienceIndex].bullets.splice(bullet.bulletIndex, 1);
            }
        });

        onResumeUpdate(updatedData);
    };

    const handleShrinkFont = () => {
        setPreviousFontScale(fontScale);
        setPreviousData(null);
        // Shrink by 5% each time, min 0.8 (80%)
        setFontScale(prev => Math.max(0.8, prev - 0.05));
    };

    const handleUndo = () => {
        if (previousData && onResumeUpdate) {
            onResumeUpdate(previousData);
            setPreviousData(null);
        }
        if (previousFontScale !== null) {
            setFontScale(previousFontScale);
            setPreviousFontScale(null);
        }
    };

    const handleReset = () => {
        setFontScale(1);
        setPreviousData(null);
        setPreviousFontScale(null);
    };

    const canUndo = previousData !== null || previousFontScale !== null;

    return (
        <div className="flex h-full w-full bg-zinc-200">
            {/* Main Preview Area */}
            <div className="flex-1 p-6 overflow-y-auto">
                {/* Persistent Toolbar */}
                <div className="mx-auto max-w-[210mm] mb-4 flex justify-between items-center">
                    {/* Font Controls */}
                    <div className="flex items-center gap-2 bg-white rounded-md p-1 shadow-sm border">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={handleShrinkFont}
                            disabled={fontScale <= 0.8}
                            title="Shrink Text"
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-medium w-12 text-center text-zinc-600">
                            {Math.round(fontScale * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setFontScale(prev => Math.min(1.2, prev + 0.05))}
                            disabled={fontScale >= 1.2}
                            title="Enlarge Text"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        {(fontScale !== 1 || previousFontScale !== null) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-600"
                                onClick={handleReset}
                                title="Reset Size"
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        onClick={() => window.print()}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Export PDF
                    </Button>
                </div>

                {/* Overflow Warning with Smart Suggestions */}
                {isOverflowing && (
                    <div className="mx-auto max-w-[210mm] mb-4 bg-red-50 border border-red-300 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700">
                                    Resume exceeds one page ({Math.round((contentHeight / A4_HEIGHT_PX) * 100)}%)
                                </p>
                                <p className="text-xs text-red-600">
                                    Choose an option to fit on one page:
                                </p>
                            </div>
                            {fontScale < 1 && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                    Font: {Math.round(fontScale * 100)}%
                                </span>
                            )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex gap-2 mb-4">
                            <Button
                                size="sm"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleAutoRemoveWeak}
                                disabled={bulletsToRemove.length === 0}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove {bulletsToRemove.length} Weak Point{bulletsToRemove.length > 1 ? 's' : ''}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={handleShrinkFont}
                                disabled={fontScale <= 0.8}
                            >
                                Shrink Font ({Math.round(fontScale * 100)}% → {Math.round(Math.max(0.8, fontScale - 0.05) * 100)}%)
                            </Button>
                            {canUndo && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-zinc-400 text-zinc-600 hover:bg-zinc-100"
                                    onClick={handleUndo}
                                >
                                    ↩ Undo
                                </Button>
                            )}
                            {fontScale < 1 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-zinc-500"
                                    onClick={handleReset}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>

                        {/* Individual bullet suggestions */}
                        {bulletsToRemove.length > 0 && (
                            <div className="space-y-2 border-t border-red-200 pt-3">
                                <p className="text-xs text-red-600 font-medium">Or remove individually:</p>
                                {bulletsToRemove.map((bullet, idx) => {
                                    const exp = data.experience?.[bullet.experienceIndex];
                                    const jobRef = exp ? `${exp.role} @ ${exp.company}` : `Job #${bullet.experienceIndex + 1}`;
                                    return (
                                        <div key={idx} className="flex items-center gap-2 bg-white rounded p-2 border border-red-200">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded shrink-0">
                                                        {jobRef}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400">Bullet #{bullet.bulletIndex + 1}</span>
                                                </div>
                                                <p className="text-xs text-zinc-700 truncate">{bullet.text}</p>
                                                <p className="text-[10px] text-red-500">{bullet.reason}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-red-600 hover:bg-red-100 shrink-0"
                                                onClick={() => handleRemoveBullet(bullet.experienceIndex, bullet.bulletIndex)}
                                            >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Remove
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Success message when fits */}
                {!isOverflowing && fontScale < 1 && (
                    <div className="mx-auto max-w-[210mm] mb-4 bg-green-50 border border-green-300 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-green-600">✓</span>
                            <span className="text-sm text-green-700">Resume fits on one page! (Font: {Math.round(fontScale * 100)}%)</span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-zinc-500" onClick={handleReset}>
                            Reset Font
                        </Button>
                    </div>
                )}

                {/* LaTeX-Style Resume */}
                <div className="mx-auto max-w-[210mm] relative">
                    <div
                        id="resume-preview-content"
                        ref={contentRef}
                        className="w-full bg-white shadow-xl text-black font-serif"
                        style={{
                            minHeight: '297mm', // Changed from height to minHeight
                            padding: '12mm 15mm',
                            fontSize: `${currentFontSize}pt`,
                            lineHeight: '1.5',
                            // Removed overflow: hidden to ensure content is visible
                        }}
                    >
                        {/* Header - Centered Name */}
                        <div className="text-center mb-1">
                            <h1 className="text-[1.8em] font-bold tracking-wide">{data.profile.name}</h1>
                            <div className="flex justify-center items-center gap-2 text-[0.85em] text-zinc-700 mt-1 flex-wrap">
                                <span>{data.profile.phone}</span>
                                <span className="text-zinc-400">|</span>
                                <a href={`mailto:${data.profile.email}`} className="text-blue-700 hover:underline">{data.profile.email}</a>
                                {data.profile.linkedin && (
                                    <>
                                        <span className="text-zinc-400">|</span>
                                        <a href="#" className="text-blue-700 hover:underline">LinkedIn</a>
                                    </>
                                )}
                                {data.profile.website && (
                                    <>
                                        <span className="text-zinc-400">|</span>
                                        <a href="#" className="text-blue-700 hover:underline">Portfolio</a>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Education */}
                        {data.education?.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Education
                                </h2>
                                {data.education.map((edu) => (
                                    <div key={edu.id} className="mb-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold">{edu.school}</span>
                                            <span className="text-[0.85em]">{edu.startDate} – {edu.endDate}</span>
                                        </div>
                                        <div className="text-[0.85em] italic text-zinc-600">
                                            {edu.degree} in {edu.field}
                                            {edu.grade && <span className="ml-2">(GPA: {edu.grade})</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Professional Experience */}
                        {data.experience?.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Professional Experience
                                </h2>
                                {data.experience.map((exp) => (
                                    <div key={exp.id} className="mb-2">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-bold">{exp.role}</span>
                                            <span className="text-[0.85em]">{exp.startDate} – {exp.endDate}</span>
                                        </div>
                                        <div className="flex justify-between text-[0.85em]">
                                            <span className="italic text-zinc-600">{exp.company}</span>
                                            <span className="text-zinc-500">{exp.location}</span>
                                        </div>
                                        <ul className="mt-0.5 ml-4 space-y-0">
                                            {exp.bullets?.map((bullet, idx) => (
                                                <li key={idx} className="text-[0.85em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                    {highlightMetrics(bullet, data.skills || [])}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Positions of Responsibility */}
                        {data.responsibilities?.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Positions of Responsibility
                                </h2>
                                {data.responsibilities.map((resp) => (
                                    <div key={resp.id} className="mb-2">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-bold">{resp.title}</span>
                                            <span className="text-[0.85em]">{resp.startDate} – {resp.endDate}</span>
                                        </div>
                                        <div className="flex justify-between text-[0.85em]">
                                            <span className="italic text-zinc-600">{resp.organization}</span>
                                            <span className="text-zinc-500">{resp.location}</span>
                                        </div>
                                        <ul className="mt-1 ml-4">
                                            <li className="text-[0.85em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                {highlightMetrics(resp.description, data.skills || [])}
                                            </li>
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Projects */}
                        {data.projects?.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Projects
                                </h2>
                                {data.projects.map((project) => (
                                    <div key={project.id} className="mb-2">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-bold">{project.name}</span>
                                            {project.link && (
                                                <a href={project.link} className="text-blue-700 text-[0.85em] hover:underline">Link</a>
                                            )}
                                        </div>
                                        {project.technologies?.length > 0 && (
                                            <p className="text-[0.85em] text-zinc-600">{project.technologies.join(", ")}</p>
                                        )}
                                        <ul className="mt-1 ml-4">
                                            {project.bullets?.map((bullet, idx) => (
                                                <li key={idx} className="text-[0.85em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                                    {highlightMetrics(bullet, data.skills || [])}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Achievements */}
                        {(data.achievements?.length ?? 0) > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Achievements & Certifications
                                </h2>
                                <ul className="ml-4 space-y-0.5">
                                    {data.achievements?.map((achievement: string, idx: number) => (
                                        <li key={idx} className="text-[0.85em] pl-1 relative before:content-['•'] before:absolute before:-left-3 before:text-zinc-400">
                                            {highlightMetrics(achievement, data.skills || [])}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Skills */}
                        {data.skills?.length > 0 && (
                            <div className="mb-4">
                                <h2 className="text-[0.95em] font-bold text-blue-800 border-b border-zinc-300 pb-0.5 mb-1 uppercase tracking-wider">
                                    Skills
                                </h2>

                                {/* Technical Skills */}
                                <p className="text-[0.85em]">
                                    <span className="font-semibold">Technical:</span> {data.skills.join(", ")}
                                </p>

                                {/* Soft Skills */}
                                {(data.softSkills?.length ?? 0) > 0 && (
                                    <p className="text-[0.85em] mt-1">
                                        <span className="font-semibold">Soft Skills:</span> {data.softSkills?.join(", ")}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Page break indicator */}
                    {isOverflowing && (
                        <div
                            className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-10"
                            style={{ top: '297mm' }}
                        >
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded whitespace-nowrap">
                                ✂️ Page 1 ends here
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
