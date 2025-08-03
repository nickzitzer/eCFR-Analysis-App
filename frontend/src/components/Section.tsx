"use client";

import React from 'react';

export interface SectionData {
    id: number;
    name: string;
    content: string;
    parent_id: number | null;
    children: SectionData[];
}

const Section: React.FC<{ section: SectionData, expandedSection?: string | null }> = ({ section, expandedSection }) => {
    const isExpanded = section.id === parseInt(expandedSection || '', 10);

    if (section.children && section.children.length > 0) {
        return (
            <details key={section.id} open={isExpanded || section.children.some(c => c.id === parseInt(expandedSection || '', 10))}>
                <summary className="font-semibold cursor-pointer">{section.name}</summary>
                <p className="mt-1 text-gray-700 whitespace-pre-wrap">{section.content || 'No content available.'}</p>
                <ul className="mt-2 space-y-3 pl-4">
                    {section.children.map(child => (
                        <Section key={child.id} section={child} expandedSection={expandedSection} />
                    ))}
                </ul>
            </details>
        );
    }

    return (
        <li key={section.id} className={isExpanded ? 'bg-yellow-100' : ''}>
            <h5 className="font-semibold">{section.name}</h5>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{section.content || 'No content available.'}</p>
        </li>
    );
};

export default Section;
