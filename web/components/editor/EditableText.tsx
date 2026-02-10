"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    multiline?: boolean;
    placeholder?: string;
    tagName?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
    renderPreview?: (value: string) => React.ReactNode;
    style?: React.CSSProperties;
}

export function EditableText({
    value,
    onChange,
    className,
    multiline = false,
    placeholder = "Type here...",
    tagName = 'span',
    renderPreview,
    style
}: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const contentRef = useRef<HTMLElement>(null);

    const handleBlur = () => {
        setIsEditing(false);
        if (contentRef.current) {
            const newValue = contentRef.current.innerText;
            if (newValue !== value) {
                onChange(newValue);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            contentRef.current?.blur();
        }
    };

    const Tag = tagName as any;

    if (!isEditing && renderPreview) {
        return (
            <Tag
                className={cn(className, "cursor-text hover:bg-black/5 hover:rounded-[2px] px-[2px] -mx-[2px] transition-colors")}
                onClick={() => setIsEditing(true)}
                style={style}
            >
                {renderPreview(value)}
            </Tag>
        );
    }

    return (
        <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsEditing(true)}
            style={style}
            className={cn(
                "outline-none transition-all border-b border-transparent hover:border-zinc-300 focus:border-blue-500 rounded-sm px-[2px] -mx-[2px] empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 cursor-text",
                isEditing && "bg-blue-50/50 min-w-[20px] inline-block",
                className
            )}
            data-placeholder={placeholder}
        >
            {value}
        </Tag>
    );
}
