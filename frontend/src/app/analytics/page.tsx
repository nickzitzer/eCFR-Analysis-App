"use client";

import React, { useEffect, useState } from 'react';
import { Agency, DashboardAnalyticsType } from '@/app/data';
import AgencyDropdown from '@/components/AgencyDropdown';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import InfoTooltip from '@/components/InfoTooltip';

const buildAgencyTree = (agencies: Agency[]): Agency[] => {
    const agencyMap: Map<number, Agency> = new Map();
    agencies.forEach(agency => {
        agencyMap.set(agency.id, { ...agency });
    });

    const tree: Agency[] = [];
    agencies.forEach(agency => {
        if (agency.parent_id) {
            const parent = agencyMap.get(agency.parent_id);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(agencyMap.get(agency.id)!);
            }
        } else {
            tree.push(agencyMap.get(agency.id)!);
        }
    });

    return tree;
};

const flattenAgencies = (agencies: Agency[]): Agency[] => {
    let list: Agency[] = [];
    for (const agency of agencies) {
        list.push(agency);
        if (agency.children) {
            list = list.concat(flattenAgencies(agency.children));
        }
    }
    return list;
}

const AnalyticsDashboard: React.FC = () => {
    const [analytics, setAnalytics] = useState<DashboardAnalyticsType | null>(null);
    const [selectedAgency, setSelectedAgency] = useState<number | null>(null);
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [selectedAgencyName, setSelectedAgencyName] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const complexityUrl = selectedAgency ? `/api/analytics/complexity?agencyId=${selectedAgency}` : '/api/analytics/complexity';
                const amendmentsUrl = selectedAgency ? `/api/analytics/amendments?agencyId=${selectedAgency}` : '/api/analytics/amendments';
                const regsByAgencyUrl = selectedAgency ? `/api/analytics/regulations-by-agency?agencyId=${selectedAgency}` : '/api/analytics/regulations-by-agency';
                const complexityOverTimeUrl = selectedAgency ? `/api/analytics/complexity-over-time?agencyId=${selectedAgency}` : '/api/analytics/complexity-over-time';
                const totalWordCountUrl = selectedAgency ? `/api/analytics/word-count?agencyId=${selectedAgency}` : '/api/analytics/word-count';

                const [agenciesRes, titlesRes, complexityRes, amendmentsRes, regsByAgencyRes, complexityOverTimeRes, totalWordCountRes] = await Promise.all([
                    fetch('/api/agencies'),
                    fetch('/api/titles'),
                    fetch(complexityUrl),
                    fetch(amendmentsUrl),
                    fetch(regsByAgencyUrl),
                    fetch(complexityOverTimeUrl),
                    fetch(totalWordCountUrl)
                ]);
                const agenciesData = await agenciesRes.json();
                const titles = await titlesRes.json();
                const complexityData = await complexityRes.json();
                const amendmentsData = await amendmentsRes.json();
                const regsByAgencyData = await regsByAgencyRes.json();
                const complexityOverTimeData = await complexityOverTimeRes.json();
                const totalWordCountData = await totalWordCountRes.json();

                const agencyTree = buildAgencyTree(agenciesData);
                setAgencies(agencyTree);

                const totalRegs = titles.length;

                const regsByAgency = regsByAgencyData.map((agency: { short_name: string; name: string; id: number; count: number }) => ({
                    agency: agency.short_name || agency.name,
                    id: agency.id,
                    count: Number(agency.count),
                }));

                const complexityOverTime = complexityOverTimeData.map((d: { year: number; score: string }) => ({
                    year: d.year,
                    score: parseFloat(parseFloat(d.score).toFixed(2))
                }));

                setAnalytics({
                    key_stats: {
                        total_regs: totalRegs,
                        avg_complexity: parseFloat(parseFloat(complexityData.avg_complexity).toFixed(2)),
                        avg_amendments: parseFloat(parseFloat(amendmentsData.avg_amendments).toFixed(1)),
                        total_word_count: totalWordCountData.total_word_count ? parseInt(totalWordCountData.total_word_count, 10) : 0,
                        total_unique_word_count: 0
                    },
                    regs_by_agency: regsByAgency,
                    complexity_over_time: complexityOverTime,
                    trending_topics: ['Cybersecurity', 'Supply Chain', 'Environmental Impact', 'Data Privacy', 'AI Governance']
                });
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            }
        };

        fetchAnalytics();
    }, [selectedAgency]);

    useEffect(() => {
        const fetchUniqueWordCounts = async () => {
            try {
                const uniqueWordCountUrl = selectedAgency ? `/api/analytics/unique-word-count?agencyId=${selectedAgency}` : '/api/analytics/unique-word-count';

                const uniqueWordCountRes = await fetch(uniqueWordCountUrl);

                const uniqueWordCountData = await uniqueWordCountRes.json();

                setAnalytics(prevAnalytics => {
                    if (!prevAnalytics) return null;
                    return {
                        ...prevAnalytics,
                        key_stats: {
                            ...prevAnalytics.key_stats,
                            total_unique_word_count: parseInt(uniqueWordCountData.total_unique_word_count, 10)
                        }
                    };
                });
            } catch (error) {
                console.error('Failed to fetch word counts:', error);
            }
        };

        if (analytics) {
            fetchUniqueWordCounts();
        }
    }, [selectedAgency, analytics]);

    const handleAgencySelect = (agencyId: number | null) => {
        setSelectedAgency(agencyId);
        if (agencyId === null) {
            setSelectedAgencyName(null);
        } else {
            const flatAgencies = flattenAgencies(agencies);
            const agency = flatAgencies.find(a => a.id === agencyId);
            setSelectedAgencyName(agency ? agency.name : null);
        }
    };

    if (!analytics) {
        return <div>Loading...</div>;
    }

    const { key_stats, regs_by_agency, complexity_over_time } = analytics;
    const maxAgencyCount = Math.max(...regs_by_agency.map(a => a.count));

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
            <header className="mb-8">
                <h2 className="text-3xl font-bold">Overall Analytics Dashboard</h2>
                <p className="text-lg text-gray-600">A high-level view of the federal regulatory environment.</p>
            </header>

            <section className="mb-8">
                <label htmlFor="agency-filter-dash" className="block text-sm font-medium text-gray-700 mb-1">Filter Dashboard by Agency</label>
                <div className="w-full md:w-1/3">
                    <AgencyDropdown agencies={agencies} onAgencySelect={handleAgencySelect} />
                </div>
            </section>

            {/* Key Stats */}
            <section className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8" aria-label="Key Statistics">
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Total Titles</h3><p className="text-6xl font-bold text-primary">{key_stats.total_regs.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center">
                    <div className="flex items-center justify-center">
                        <h3 className="text-lg font-semibold text-gray-500">Total Word Count</h3>
                        <InfoTooltip text={totalWordCountTooltipContent} />
                    </div>
                    <span className="text-5xl font-bold text-primary responsive-text">{key_stats.total_word_count ? key_stats.total_word_count.toLocaleString() : <LoadingSpinner />}</span>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center">
                    <div className="flex items-center justify-center">
                        <h3 className="text-lg font-semibold text-gray-500">Unique Words</h3>
                        <InfoTooltip text={uniqueWordCountTooltipContent} />
                    </div>
                    <span className="text-6xl font-bold text-primary responsive-text">{key_stats.total_unique_word_count ? key_stats.total_unique_word_count.toLocaleString() : <LoadingSpinner />}</span>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Avg. Complexity Score</h3><p className="text-4xl font-bold text-primary">{key_stats.avg_complexity.toLocaleString()}</p><small className="text-gray-500">Complexity is calculated using Flesch-Kincaid method.</small></div>
                <div className="bg-white p-6 rounded-lg shadow-md border text-center"><h3 className="text-lg font-semibold text-gray-500">Avg. Amendments/Year</h3><p className="text-6xl font-bold text-primary">{key_stats.avg_amendments.toLocaleString()}</p></div>
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-md border" aria-labelledby="regs-by-agency-heading">
                    <h3 id="regs-by-agency-heading" className="text-xl font-bold mb-4">Parts by Agency</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
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
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={complexity_over_time}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="year" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#8884d8" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                    <small className="text-gray-500 w-full center">Complexity is calculated using Flesch-Kincaid method.</small>
                </div>
            </section>
        </main>
    );
};

export default AnalyticsDashboard;
