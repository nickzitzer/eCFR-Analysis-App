import React from 'react';
import { ChartBarIcon } from './Icons';

interface RegulationDetailProps {
    regulation: {
        id: number;
        title: string;
        agency: string;
        text: string;
        analysis: {
            word_count: number;
            complexity_score: number;
            amendment_frequency: number;
            keywords: { word: string; count: number; }[];
        };
    };
    onBack: () => void;
}

const RegulationDetail: React.FC<RegulationDetailProps> = ({ regulation, onBack }) => {
    return (
        <main id="main-content" className="p-4 sm:p-6 md:p-8">
            <button onClick={onBack} className="text-primary font-semibold mb-6">&larr; Back to Search Results</button>
            <header className="mb-6">
                <h2 className="text-3xl font-bold">{regulation.title}</h2>
                <p className="text-lg text-gray-600">{regulation.agency}</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <article className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border">
                    <h3 className="text-xl font-bold mb-4">Regulation Text</h3>
                    <p className="leading-relaxed whitespace-pre-wrap">{regulation.text}</p>
                </article>
                <aside className="space-y-8">
                     <section className="bg-white p-6 rounded-lg shadow-md border" aria-labelledby="analysis-heading">
                        <h3 id="analysis-heading" className="text-xl font-bold mb-4 flex items-center text-primary"><ChartBarIcon /> Analysis</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between"><span>Complexity Score:</span> <span className="font-bold">{regulation.analysis.complexity_score}</span></div>
                            <div className="flex justify-between"><span>Word Count:</span> <span className="font-bold">{regulation.analysis.word_count.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Amendments:</span> <span className="font-bold">{regulation.analysis.amendment_frequency}</span></div>
                        </div>
                     </section>
                </aside>
            </div>
        </main>
    );
};

export default RegulationDetail;
