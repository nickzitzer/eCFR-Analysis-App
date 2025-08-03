"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import RegulationDetail, { Chapter, Part, Regulation } from '../../../components/RegulationDetail';
import { SectionData } from '../../../components/Section';


const buildSectionHierarchy = (sections: SectionData[]): SectionData[] => {
    const sectionMap = new Map<number, SectionData>();
    const rootSections: SectionData[] = [];

    sections.forEach(section => {
        section.children = [];
        sectionMap.set(section.id, section);
    });

    sections.forEach(section => {
        if (section.parent_id && sectionMap.has(section.parent_id)) {
            sectionMap.get(section.parent_id)!.children.push(section);
        } else {
            rootSections.push(section);
        }
    });

    return rootSections;
};

const RegulationDetailPage = () => {
    const [regulation, setRegulation] = useState<Regulation | null>(null);
    const [loading, setLoading] = useState(true);
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = params;
    const expandedSection = searchParams.get('expanded');

    useEffect(() => {
        if (id) {
            fetch(`/api/titles/${id}/details`)
                .then(res => res.json())
                .then(data => {
                    data.chapters.forEach((chapter: Chapter) => {
                        chapter.parts.forEach((part: Part) => {
                            part.children = buildSectionHierarchy(part.sections);
                        });
                    });
                    setRegulation(data);
                    setLoading(false);
                })
                .catch(error => {
                    console.error("Failed to fetch regulation details:", error);
                    setLoading(false);
                });
        }
    }, [id]);

    const handleBack = () => {
        router.push('/explorer');
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <RegulationDetail regulation={regulation} onBack={handleBack} expandedSection={expandedSection} />
    );
};

export default RegulationDetailPage;
