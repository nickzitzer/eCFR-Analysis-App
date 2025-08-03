"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from '@/components/Icons';
import { Agency, Regulation, SearchResult } from '@/app/data';
import AgencyDropdown from '@/components/AgencyDropdown';
import LoadingSpinner from '@/components/LoadingSpinner';

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

const ExplorerDashboard: React.FC = () => {
    const router = useRouter();
    const [regulations, setRegulations] = useState<Regulation[]>([]);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [selectedAgency, setSelectedAgency] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (debouncedSearchQuery) {
                    let url = `/api/search?q=${debouncedSearchQuery}`;
                    if (selectedAgency) {
                        url += `&agencyId=${selectedAgency}`;
                    }
                    console.log(`Fetching search results from: ${url}`);
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log('Received search results:', data);
                    setSearchResults(data);
                    setRegulations([]);
                } else {
                    let url = '/api/titles';
                    if (selectedAgency) {
                        url = `/api/agencies/${selectedAgency}/regulations`;
                    }
                    console.log(`Fetching regulations from: ${url}`);
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log('Received regulations:', data);
                    setRegulations(data);
                    setSearchResults([]);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedAgency, debouncedSearchQuery]);

    useEffect(() => {
        const fetchAgencies = async () => {
            try {
                const response = await fetch('/api/agencies');
                const data = await response.json();
                const tree = buildAgencyTree(data);
                setAgencies(tree);
            } catch (error) {
                console.error('Failed to fetch agencies:', error);
            }
        };

        fetchAgencies();
    }, []);

    const handleSelectRegulation = (regulation: Regulation) => {
        router.push(`/regulations/${regulation.id}`);
    };

    const handleViewDetails = (titleId: number, sectionId: number) => {
        router.push(`/regulations/${titleId}?expanded=${sectionId}`);
    };

    const handleAgencySelect = (agencyId: number | null) => {
        setSelectedAgency(agencyId);
    };

    return (
        <main id="main-content" className="p-4 sm:p-6 md:p-8">
            <header className="text-center mb-8">
                <h2 className="text-3xl font-bold">eCFR Regulation Explorer</h2>
                <p className="text-lg text-gray-600 mt-1">Search, analyze, and understand federal regulations.</p>
            </header>
            <section className="bg-white p-6 rounded-lg shadow-md border mb-8" aria-labelledby="search-filter-heading">
                <h3 id="search-filter-heading" className="sr-only">Search and Filter Regulations</h3>
                <form role="search" onSubmit={(e) => e.preventDefault()} suppressHydrationWarning>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-1">Search Regulations</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input
                                    suppressHydrationWarning
                                    type="search"
                                    id="search-query"
                                    className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent"
                                    placeholder="e.g., 'workplace safety'"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <AgencyDropdown agencies={agencies} onAgencySelect={handleAgencySelect} />
                        </div>
                    </div>
                </form>
            </section>
            <section aria-labelledby="results-heading">
                <h2 id="results-heading" className="sr-only">Search Results</h2>
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center p-8">
                            <LoadingSpinner />
                        </div>
                    ) : debouncedSearchQuery ? (
                        searchResults.length > 0 ? (
                            searchResults.map(result => (
                                <article key={result.title_id} className="bg-white p-4 rounded-lg shadow-sm border">
                                    <h3 className="text-lg font-bold text-primary">{result.title_name}</h3>
                                    <div className="mt-2 space-y-2">
                                        {result.sections.map(section => (
                                            <div key={section.section_id} className="pl-4 border-l-2 border-gray-200">
                                                <div dangerouslySetInnerHTML={{ __html: section.excerpt }} className="text-sm text-gray-600" />
                                                <button onClick={() => handleViewDetails(result.title_id, section.section_id)} className="mt-1 text-sm text-primary hover:underline">View Details</button>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="text-center p-8">
                                <h3 className="text-lg font-semibold">No Results Found</h3>
                                <p className="text-gray-600">Try adjusting your search terms.</p>
                            </div>
                        )
                    ) : (
                        regulations.map(reg => (
                            <article key={reg.id} className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div><h3 className="text-lg font-bold text-primary">{reg.name}</h3><p className="text-sm text-gray-600">{`Title ${reg.title_number}`}</p></div>
                                    <button onClick={() => handleSelectRegulation(reg)} className="ml-4 flex-shrink-0 bg-primary text-white px-4 py-2 rounded-md font-semibold text-sm">View Details</button>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </section>
        </main>
    );
};

export default ExplorerDashboard;
