import React from 'react';
import { SearchIcon } from './Icons';

interface Regulation {
    id: number;
    title: string;
    description: string;
    agency: string;
}

interface ExplorerDashboardProps {
    mockRegulations: Regulation[];
    onSelectRegulation: (regulation: Regulation) => void;
}

const ExplorerDashboard: React.FC<ExplorerDashboardProps> = ({ mockRegulations, onSelectRegulation }) => {
    return (
        <main id="main-content" className="p-4 sm:p-6 md:p-8">
            <header className="text-center mb-8">
                <h2 className="text-3xl font-bold">eCFR Regulation Explorer</h2>
                <p className="text-lg text-gray-600 mt-1">Search, analyze, and understand federal regulations.</p>
            </header>
            <section className="bg-white p-6 rounded-lg shadow-md border mb-8" aria-labelledby="search-filter-heading">
                <h3 id="search-filter-heading" className="sr-only">Search and Filter Regulations</h3>
                <form role="search">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-1">Search Regulations</label>
                            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div><input type="search" id="search-query" className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent" placeholder="e.g., 'workplace safety'" /></div>
                        </div>
                        <div>
                            <label htmlFor="agency-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Agency</label>
                            <select id="agency-filter" className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent"><option>All Agencies</option><option>EPA</option><option>OSHA</option><option>FDA</option><option>HHS</option></select>
                        </div>
                    </div>
                </form>
            </section>
            <section aria-labelledby="results-heading">
                <h2 id="results-heading" className="sr-only">Search Results</h2>
                <div className="space-y-4">
                    {mockRegulations.map(reg => (
                        <article key={reg.id} className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div><h3 className="text-lg font-bold text-primary">{reg.title}</h3><p className="text-sm text-gray-600">{reg.description}</p></div>
                                <button onClick={() => onSelectRegulation(reg)} className="ml-4 flex-shrink-0 bg-primary text-white px-4 py-2 rounded-md font-semibold text-sm">View Details</button>
                            </div>
                            <p className="mt-2 text-xs font-semibold text-gray-500 bg-gray-100 inline-block px-2 py-1 rounded-full">{reg.agency}</p>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
};

export default ExplorerDashboard;
