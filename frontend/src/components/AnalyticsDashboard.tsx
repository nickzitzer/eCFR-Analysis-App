import React from 'react';

interface AnalyticsDashboardProps {
    mockDashboardAnalytics: {
        key_stats: { total_regs: number; avg_complexity: number; avg_amendments: number; };
        regs_by_agency: { agency: string; count: number; }[];
        complexity_over_time: { year: number; score: number; }[]; // Keep this for the mock data structure
        trending_topics: string[];
    };
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ mockDashboardAnalytics }) => {
    const { key_stats, regs_by_agency, trending_topics } = mockDashboardAnalytics;
    const maxAgencyCount = Math.max(...regs_by_agency.map(a => a.count));

    return (
        <main id="main-content" className="p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h2 className="text-3xl font-bold">Overall Analytics Dashboard</h2>
                <p className="text-lg text-gray-600">A high-level view of the federal regulatory environment.</p>
            </header>

            <section className="mb-8">
                <label htmlFor="agency-filter-dash" className="block text-sm font-medium text-gray-700 mb-1">Filter Dashboard by Agency</label>
                <select id="agency-filter-dash" className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent">
                    <option>All Agencies</option>
                    <option>EPA</option>
                    <option>OSHA</option>
                    <option>FDA</option>
                    <option>HHS</option>
                    <option>DOT</option>
                </select>
            </section>

            {/* Key Stats */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" aria-label="Key Statistics">
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Total Regulations</h3><p className="text-4xl font-bold text-primary">{key_stats.total_regs.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Avg. Complexity Score</h3><p className="text-4xl font-bold text-primary">{key_stats.avg_complexity}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Avg. Amendments/Year</h3><p className="text-4xl font-bold text-primary">{key_stats.avg_amendments}</p></div>
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-md border" aria-labelledby="regs-by-agency-heading">
                    <h3 id="regs-by-agency-heading" className="text-xl font-bold mb-4">Regulations by Agency</h3>
                    <div className="space-y-3">
                        {regs_by_agency.map(item => (
                            <div key={item.agency} className="flex items-center">
                                <span className="w-16 text-sm font-bold">{item.agency}</span>
                                <div className="w-full bg-gray-200 rounded-full h-6"><div className="bg-primary h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs" style={{ width: `${(item.count / maxAgencyCount) * 100}%` }}>{item.count.toLocaleString()}</div></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border" aria-labelledby="complexity-over-time-heading">
                    <h3 id="complexity-over-time-heading" className="text-xl font-bold mb-4">Complexity Over Time</h3>
                    <div className="h-64 bg-gray-50 rounded-lg border flex items-center justify-center text-gray-400">[Line Chart Visualization Area]</div>
                </div>
            </section>

            {/* Trending Topics */}
            <section className="bg-white p-6 rounded-lg shadow-md border" aria-labelledby="trending-topics-heading">
                <h3 id="trending-topics-heading" className="text-xl font-bold mb-4">Trending Topics</h3>
                <div className="flex flex-wrap gap-3">
                    {trending_topics.map(topic => <span key={topic} className="bg-accent text-white text-sm font-semibold px-3 py-1 rounded-full">{topic}</span>)}
                </div>
            </section>
        </main>
    );
};

export default AnalyticsDashboard;
