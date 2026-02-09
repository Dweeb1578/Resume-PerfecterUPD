"use client";

import { ResumeData, ResumeExperience, ResumeProject, ResumeResponsibility, ResumeEducation, SectionType } from "@/types/resume";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, X, ChevronDown, ChevronRight, Briefcase, FolderKanban, Award, GraduationCap, Star, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SectionManagerProps {
    data: ResumeData;
    onUpdate: (data: ResumeData) => void;
}

interface DraggableItemProps {
    item: { id: string; label: string; sublabel?: string; hidden?: boolean };
    onToggleHide: () => void;
}

function DraggableItem({ item, onToggleHide }: DraggableItemProps) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={item}
            dragListener={false}
            dragControls={controls}
            className={`flex items-center gap-2 bg-white rounded-lg p-2 border border-zinc-200 shadow-sm mb-1 cursor-default transition-opacity ${item.hidden ? 'opacity-50' : ''}`}
            whileDrag={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
            <div
                className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-zinc-600"
                onPointerDown={(e) => controls.start(e)}
            >
                <GripVertical className="h-4 w-4" />
            </div>
            <div className={`flex-1 min-w-0 ${item.hidden ? 'line-through text-zinc-400' : ''}`}>
                <p className="text-sm font-medium text-zinc-800 truncate">{item.label}</p>
                {item.sublabel && (
                    <p className="text-xs text-zinc-500 truncate">{item.sublabel}</p>
                )}
            </div>
            <button
                onClick={onToggleHide}
                className={`p-1 text-lg transition-colors ${item.hidden ? 'opacity-50 hover:opacity-100' : 'hover:bg-zinc-100'} rounded`}
                title={item.hidden ? 'Show item' : 'Hide item'}
            >
                {item.hidden ? '🙈' : '👁️'}
            </button>
        </Reorder.Item>
    );
}

interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    count: number;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, count, children, defaultOpen = false }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors"
            >
                {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                {icon}
                <span className="flex-1 text-left text-sm font-medium text-zinc-700">{title}</span>
                <span className="text-xs bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">{count}</span>
            </button>
            {isOpen && (
                <div className="p-2 bg-zinc-50/50">
                    {children}
                </div>
            )}
        </div>
    );
}

export function SectionManager({ data, onUpdate }: SectionManagerProps) {
    // Default section order
    const DEFAULT_SECTION_ORDER: SectionType[] = ['education', 'experience', 'responsibilities', 'projects', 'achievements', 'skills'];
    const sectionOrder = data.sectionOrder || DEFAULT_SECTION_ORDER;

    // Section labels and icons for display
    const sectionConfig: Record<SectionType, { label: string; icon: React.ReactNode }> = {
        education: { label: 'Education', icon: <GraduationCap className="h-4 w-4 text-green-600" /> },
        experience: { label: 'Experience', icon: <Briefcase className="h-4 w-4 text-blue-600" /> },
        responsibilities: { label: 'Positions', icon: <Star className="h-4 w-4 text-amber-600" /> },
        projects: { label: 'Projects', icon: <FolderKanban className="h-4 w-4 text-purple-600" /> },
        achievements: { label: 'Achievements', icon: <Award className="h-4 w-4 text-orange-600" /> },
        skills: { label: 'Skills', icon: <Wrench className="h-4 w-4 text-rose-600" /> },
    };

    // Handle section reorder
    const handleSectionReorder = (newOrder: SectionType[]) => {
        onUpdate({ ...data, sectionOrder: newOrder });
    };

    // Convert arrays to items with id and labels for Reorder
    const experienceItems = (data.experience || []).map(exp => ({
        id: exp.id,
        label: exp.role,
        sublabel: exp.company,
        hidden: exp.hidden,
        original: exp
    }));

    const projectItems = (data.projects || []).map(proj => ({
        id: proj.id,
        label: proj.name,
        sublabel: proj.technologies?.slice(0, 3).join(", "),
        hidden: proj.hidden,
        original: proj
    }));

    const responsibilityItems = (data.responsibilities || []).map(resp => ({
        id: resp.id,
        label: resp.title,
        sublabel: resp.organization,
        hidden: resp.hidden,
        original: resp
    }));

    const educationItems = (data.education || []).map(edu => ({
        id: edu.id,
        label: edu.degree,
        sublabel: edu.school,
        hidden: edu.hidden,
        original: edu
    }));

    const achievementItems = (data.achievements || []).map((ach, idx) => ({
        id: `ach-${idx}`,
        label: ach.length > 50 ? ach.substring(0, 50) + "..." : ach,
        original: ach
    }));

    const skillItems = (data.skills || []).map((skill, idx) => ({
        id: `skill-${idx}`,
        label: skill,
        original: skill
    }));

    // Reorder handlers
    const handleExperienceReorder = (newOrder: typeof experienceItems) => {
        const updated = { ...data, experience: newOrder.map(item => item.original) };
        onUpdate(updated);
    };

    const handleProjectReorder = (newOrder: typeof projectItems) => {
        const updated = { ...data, projects: newOrder.map(item => item.original) };
        onUpdate(updated);
    };

    const handleResponsibilityReorder = (newOrder: typeof responsibilityItems) => {
        const updated = { ...data, responsibilities: newOrder.map(item => item.original) };
        onUpdate(updated);
    };

    const handleEducationReorder = (newOrder: typeof educationItems) => {
        const updated = { ...data, education: newOrder.map(item => item.original) };
        onUpdate(updated);
    };

    // Toggle hide handlers
    const toggleExperienceHidden = (id: string) => {
        const updated = {
            ...data,
            experience: data.experience.map(e => e.id === id ? { ...e, hidden: !e.hidden } : e)
        };
        onUpdate(updated);
    };

    const toggleProjectHidden = (id: string) => {
        const updated = {
            ...data,
            projects: data.projects.map(p => p.id === id ? { ...p, hidden: !p.hidden } : p)
        };
        onUpdate(updated);
    };

    const toggleResponsibilityHidden = (id: string) => {
        const updated = {
            ...data,
            responsibilities: data.responsibilities.map(r => r.id === id ? { ...r, hidden: !r.hidden } : r)
        };
        onUpdate(updated);
    };

    const toggleEducationHidden = (id: string) => {
        const updated = {
            ...data,
            education: data.education.map(e => e.id === id ? { ...e, hidden: !e.hidden } : e)
        };
        onUpdate(updated);
    };

    const removeAchievement = (idx: number) => {
        const updated = { ...data, achievements: data.achievements?.filter((_, i) => i !== idx) };
        onUpdate(updated);
    };

    const removeSkill = (idx: number) => {
        const updated = { ...data, skills: data.skills.filter((_, i) => i !== idx) };
        onUpdate(updated);
    };

    return (
        <div className="h-full overflow-y-auto bg-white border-l p-4">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-800">Resume Sections</h3>
                <p className="text-xs text-zinc-500">Drag sections to reorder, 👁️ to hide/show items</p>
            </div>

            {/* Section Order */}
            <div className="mb-4 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                <p className="text-xs font-medium text-zinc-600 mb-2">Section Order</p>
                <Reorder.Group axis="y" values={sectionOrder} onReorder={handleSectionReorder} className="space-y-1">
                    {sectionOrder.map((section) => (
                        <Reorder.Item
                            key={section}
                            value={section}
                            className="flex items-center gap-2 bg-white rounded px-2 py-1.5 border border-zinc-200 cursor-grab active:cursor-grabbing shadow-sm"
                        >
                            <GripVertical className="h-3 w-3 text-zinc-400" />
                            {sectionConfig[section].icon}
                            <span className="text-xs font-medium text-zinc-700">{sectionConfig[section].label}</span>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>

            <div className="space-y-3">
                {/* Experience */}
                <CollapsibleSection
                    title="Experience"
                    icon={<Briefcase className="h-4 w-4 text-blue-600" />}
                    count={experienceItems.length}
                    defaultOpen={true}
                >
                    <Reorder.Group axis="y" values={experienceItems} onReorder={handleExperienceReorder}>
                        {experienceItems.map(item => (
                            <DraggableItem
                                key={item.id}
                                item={item}
                                onToggleHide={() => toggleExperienceHidden(item.id)}
                            />
                        ))}
                    </Reorder.Group>
                    {experienceItems.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center py-2">No experiences</p>
                    )}
                </CollapsibleSection>

                {/* Projects */}
                <CollapsibleSection
                    title="Projects"
                    icon={<FolderKanban className="h-4 w-4 text-purple-600" />}
                    count={projectItems.length}
                >
                    <Reorder.Group axis="y" values={projectItems} onReorder={handleProjectReorder}>
                        {projectItems.map(item => (
                            <DraggableItem
                                key={item.id}
                                item={item}
                                onToggleHide={() => toggleProjectHidden(item.id)}
                            />
                        ))}
                    </Reorder.Group>
                    {projectItems.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center py-2">No projects</p>
                    )}
                </CollapsibleSection>

                {/* Responsibilities */}
                {responsibilityItems.length > 0 && (
                    <CollapsibleSection
                        title="Positions"
                        icon={<Star className="h-4 w-4 text-amber-600" />}
                        count={responsibilityItems.length}
                    >
                        <Reorder.Group axis="y" values={responsibilityItems} onReorder={handleResponsibilityReorder}>
                            {responsibilityItems.map(item => (
                                <DraggableItem
                                    key={item.id}
                                    item={item}
                                    onToggleHide={() => toggleResponsibilityHidden(item.id)}
                                />
                            ))}
                        </Reorder.Group>
                    </CollapsibleSection>
                )}

                {/* Education */}
                <CollapsibleSection
                    title="Education"
                    icon={<GraduationCap className="h-4 w-4 text-green-600" />}
                    count={educationItems.length}
                >
                    <Reorder.Group axis="y" values={educationItems} onReorder={handleEducationReorder}>
                        {educationItems.map(item => (
                            <DraggableItem
                                key={item.id}
                                item={item}
                                onToggleHide={() => toggleEducationHidden(item.id)}
                            />
                        ))}
                    </Reorder.Group>
                    {educationItems.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center py-2">No education</p>
                    )}
                </CollapsibleSection>

                {/* Achievements */}
                {achievementItems.length > 0 && (
                    <CollapsibleSection
                        title="Achievements"
                        icon={<Award className="h-4 w-4 text-orange-600" />}
                        count={achievementItems.length}
                    >
                        <div className="space-y-1">
                            {achievementItems.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-2 bg-white rounded-lg p-2 border border-zinc-200"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-700 truncate">{item.label}</p>
                                    </div>
                                    <button
                                        onClick={() => removeAchievement(idx)}
                                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>
                )}

                {/* Skills */}
                <CollapsibleSection
                    title="Skills"
                    icon={<Wrench className="h-4 w-4 text-teal-600" />}
                    count={skillItems.length}
                >
                    <div className="flex flex-wrap gap-1">
                        {skillItems.map((item, idx) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-1 bg-zinc-100 rounded-full pl-3 pr-1 py-1"
                            >
                                <span className="text-xs text-zinc-700">{item.label}</span>
                                <button
                                    onClick={() => removeSkill(idx)}
                                    className="p-0.5 text-zinc-400 hover:text-red-500 rounded-full"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    {skillItems.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center py-2">No skills</p>
                    )}
                </CollapsibleSection>
            </div>
        </div>
    );
}
