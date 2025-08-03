"use client";

import React, { useState } from 'react';
import FloatingChatbot from '../components/FloatingChatbot';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ExplorerDashboard from '../components/ExplorerDashboard';

interface Regulation {
    id: number;
    title: string;
    description: string;
    agency: string;
}

interface DashboardAnalyticsType {
    key_stats: { total_regs: number; avg_complexity: number; avg_amendments: number; };
    regs_by_agency: { agency: string; count: number; }[];
    complexity_over_time: { year: number; score: number; }[];
    trending_topics: string[];
}

// --- Mock Data ---
const mockRegulations: Regulation[] = [
    { id: 1, title: '40 CFR Part 60', description: 'Standards of Performance for New Stationary Sources', agency: 'EPA' },
    { id: 2, title: '29 CFR Part 1910', description: 'Occupational Safety and Health Standards', agency: 'OSHA' },
    { id: 3, title: '21 CFR Part 11', description: 'Electronic Records; Electronic Signatures', agency: 'FDA' },
    { id: 4, title: '45 CFR Part 164', description: 'HIPAA Security and Privacy', agency: 'HHS' },
];

const mockDashboardAnalytics: DashboardAnalyticsType = {
    key_stats: { total_regs: 185432, avg_complexity: 55.8, avg_amendments: 4.1 },
    regs_by_agency: [{ agency: 'EPA', count: 12500 }, { agency: 'HHS', count: 9800 }, { agency: 'OSHA', count: 7600 }, { agency: 'FDA', count: 6500 }, { agency: 'DOT', count: 11000 }],
    complexity_over_time: [{ year: 2018, score: 54.2 }, { year: 2019, score: 54.9 }, { year: 2020, score: 55.1 }, { year: 2021, score: 55.8 }, { year: 2022, score: 56.3 }],
    trending_topics: ['Cybersecurity', 'Supply Chain', 'Environmental Impact', 'Data Privacy', 'AI Governance']
};

const App: React.FC = () => {
    const [view, setView] = useState<'explorer' | 'dashboard'>('explorer');

    const renderView = () => {
        switch (view) {
            case 'explorer':
                return <ExplorerDashboard mockRegulations={mockRegulations} onSelectRegulation={() => {}} />;
            case 'dashboard':
                return <AnalyticsDashboard mockDashboardAnalytics={mockDashboardAnalytics} />;
            default:
                return <ExplorerDashboard mockRegulations={mockRegulations} onSelectRegulation={() => {}} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header role="banner" className="bg-primary text-white p-4 shadow-md flex justify-between items-center">
                <h1 className="text-2xl font-bold">Federal Regulation Analysis Tool</h1>
                <nav className="flex items-center space-x-2">
                    <button onClick={() => setView('explorer')} className={`px-4 py-2 rounded-md font-semibold transition-colors ${view === 'explorer' ? 'nav-active' : ''}`}>Explorer</button>
                    <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-md font-semibold transition-colors ${view === 'dashboard' ? 'nav-active' : ''}`}>Dashboard</button>
                </nav>
                <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 bg-accent text-primary font-bold p-2 rounded-md">Skip to Main Content</a>
            </header>

            {renderView()}

            <FloatingChatbot context={undefined} />

            <footer className="text-center p-4 mt-8 text-gray-500 text-sm border-t">
                <p>U.S. Federal Government | This is a demonstration application.</p>
            </footer>
        </div>
    );
};

export default App;
