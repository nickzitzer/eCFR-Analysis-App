"use client";

import React from 'react';
import { ChevronLeftIcon } from './Icons';
import Section, { SectionData } from './Section';
import InfoTooltip from '@/components/InfoTooltip';

export interface Regulation {
    id: number;
    name: string;
    title_number: number;
    chapters: Chapter[];
    stats: {
        chapter_count: string;
        part_count: string;
        section_count: string;
        avg_complexity: number;
        latest_revision: string;
        total_revisions: string;
        avg_revisions_per_year: number;
        total_word_count: string;
        total_unique_word_count: string;
    };
}

export interface Chapter {
    id: number;
    name: string;
    parts: Part[];
}

export interface Part {
    id: number;
    name: string;
    sections: SectionData[];
    children: SectionData[];
}

interface RegulationDetailProps {
    regulation: Regulation | null;
    onBack: () => void;
    expandedSection?: string | null;
}

const RegulationDetail: React.FC<RegulationDetailProps> = ({ regulation, onBack, expandedSection }) => {
    if (!regulation) {
        return (
            <main id="main-content" className="p-4 sm:p-6 md:p-8">
                <div className="max-w-6xl mx-auto text-center">
                    <p>Loading regulation data...</p>
                </div>
            </main>
        );
    }

    const totalWordCountTooltipContent = (
        <div className="text-left">
            <h4 className="font-bold mb-2">Comparative Total Word Counts</h4>
            <table className="w-full text-xs">
                <thead>
                <tr>
                    <th className="font-bold text-left pr-2">Document</th>
                    <th className="font-bold text-right">Total Words (Approx.)</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td className="text-left pr-2">Declaration of Independence</td>
                    <td className="text-right">1,337</td>
                </tr>
                <tr>
                    <td className="text-left pr-2">U.S. Constitution</td>
                    <td className="text-right">4,543</td>
                </tr>
                <tr>
                    <td className="text-left pr-2">The Bible (KJV)</td>
                    <td className="text-right">783,137</td>
                </tr>
                </tbody>
            </table>
        </div>
    );

    const uniqueWordCountTooltipContent = (
        <div className="text-left">
            <h4 className="font-bold mb-2">Comparative Unique Word Counts</h4>
            <table className="w-full text-xs">
                <thead>
                <tr>
                    <th className="font-bold text-left pr-2">Document</th>
                    <th className="font-bold text-right">Unique Words (Approx.)</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td className="text-left pr-2">Declaration of Independence</td>
                    <td className="text-right">537</td>
                </tr>
                <tr>
                    <td className="text-left pr-2">U.S. Constitution</td>
                    <td className="text-right">883</td>
                </tr>
                <tr>
                    <td className="text-left pr-2">The Bible (KJV)</td>
                    <td className="text-right">12,850</td>
                </tr>
                </tbody>
            </table>
        </div>
    );

    return (
        <main id="main-content" className="p-4 sm:p-6 md:p-8">
            <div className="max-w-6xl mx-auto">
                <button onClick={onBack} className="flex items-center text-primary font-semibold mb-4">
                    <ChevronLeftIcon />
                    Back to Explorer
                </button>

                <header className="mb-8">
                    <h2 className="text-3xl font-bold">{`Title ${regulation.title_number}: ${regulation.name}`}</h2>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Regulation Hierarchy */}
                    <section className="lg:col-span-2" aria-labelledby="regulation-hierarchy">
                        <h3 id="regulation-hierarchy" className="text-2xl font-bold mb-4">Regulation Hierarchy</h3>
                        <div className="space-y-2">
                            {regulation.chapters && regulation.chapters.map(chapter => (
                                <details key={chapter.id} open={chapter.parts.some(p => p.sections.some(s => s.id === parseInt(expandedSection || '', 10)))} className="bg-white p-3 rounded-lg shadow-sm border">
                                    <summary className="font-bold text-md cursor-pointer">{chapter.name}</summary>
                                    <div className="mt-2 space-y-1 pl-4">
                                        {chapter.parts.map(part => (
                                            <details key={part.id} open={part.sections.some(s => s.id === parseInt(expandedSection || '', 10))} className="bg-gray-50 p-2 rounded-lg">
                                                <summary className="font-semibold text-sm cursor-pointer">{part.name}</summary>
                                                <ul className="mt-2 space-y-3 pl-4">
                                                    {part.children.map(section => (
                                                        <Section key={section.id} section={section} expandedSection={expandedSection} />
                                                    ))}
                                                </ul>
                                            </details>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>

                    {/* Right Column: Key Statistics */}
                    <aside className="lg:col-span-1">
                        <div className="sticky top-8">
                            <h3 className="text-2xl font-bold mb-4">Key Statistics</h3>
                            {regulation.stats ? (
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg shadow-md border text-center">
                                        <h4 className="text-lg font-semibold text-gray-500">Chapters</h4>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.chapter_count, 10).toLocaleString()}</p>
                                        <h4 className="text-lg font-semibold text-gray-500">Parts</h4>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.part_count, 10).toLocaleString()}</p>
                                        <h4 className="text-lg font-semibold text-gray-500">Sections</h4>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.section_count, 10).toLocaleString()}</p>
                                        <div className="flex items-center justify-center">
                                            <h4 className="text-lg font-semibold text-gray-500">Total Word Count</h4>
                                            <InfoTooltip text={totalWordCountTooltipContent} />
                                        </div>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.total_word_count, 10).toLocaleString()}</p>
                                        <div className="flex items-center justify-center">
                                            <h4 className="text-lg font-semibold text-gray-500">Unique Word Count</h4>
                                            <InfoTooltip text={uniqueWordCountTooltipContent} />
                                        </div>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.total_unique_word_count, 10).toLocaleString()}</p>
                                        <h4 className="text-lg font-semibold text-gray-500">Avg. Complexity</h4>
                                        <p className="text-3xl font-bold text-primary">{regulation.stats.avg_complexity ? regulation.stats.avg_complexity.toFixed(2) : 'N/A'}</p>
                                        <small className="text-gray-500">Flesch-Kincaid method</small>
                                        <div className="border-b pb-2 border-gray-200 mb-2 w-full center" />
                                        <h4 className="text-lg font-semibold text-gray-500">Latest Revision</h4>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{regulation.stats.latest_revision ? new Date(regulation.stats.latest_revision).toLocaleDateString() : 'N/A'}</p>
                                        <h4 className="text-lg font-semibold text-gray-500">Total Revisions</h4>
                                        <p className="text-3xl font-bold text-primary border-b pb-2 border-gray-200 mb-2">{parseInt(regulation.stats.total_revisions, 10).toLocaleString()}</p>
                                        <h4 className="text-lg font-semibold text-gray-500">Avg. Revisions / Year</h4>
                                        <p className="text-3xl font-bold text-primary">{regulation.stats.avg_revisions_per_year ? regulation.stats.avg_revisions_per_year.toFixed(2) : 'N/A'}</p>
                                    </div>
                                </div>
                            ) : (
                                <p>Statistics not available.</p>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default RegulationDetail;
