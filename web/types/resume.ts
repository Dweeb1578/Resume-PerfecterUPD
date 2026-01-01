export interface ResumeProfile {
    name: string;
    email: string;
    phone: string;
    linkedin?: string;
    github?: string;
    website?: string;
    summary?: string;
}

export interface ResumeExperience {
    id: string;
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    location: string;
    bullets: string[];
}

export interface ResumeProject {
    id: string;
    name: string;
    description: string;
    technologies: string[];
    link?: string;
    bullets: string[];
}

export interface ResumeEducation {
    id: string;
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    grade?: string;
}

export interface ResumeResponsibility {
    id: string;
    title: string;
    organization: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
}

export interface ResumeData {
    profile: ResumeProfile;
    experience: ResumeExperience[];
    projects: ResumeProject[];
    education: ResumeEducation[];
    responsibilities: ResumeResponsibility[];
    skills: string[];
    achievements?: string[];
}

export const initialResumeState: ResumeData = {
    profile: {
        name: "John Doe",
        email: "john@example.com",
        phone: "(555) 123-4567",
        linkedin: "linkedin.com/in/johndoe",
        summary: "Experienced Software Engineer with a passion for building scalable web applications."
    },
    experience: [],
    projects: [],
    education: [],
    responsibilities: [],
    skills: ["JavaScript", "TypeScript", "React", "Next.js", "Node.js"]
};
