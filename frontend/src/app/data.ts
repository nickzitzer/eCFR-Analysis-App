export interface Regulation {
    id: number;
    name: string;
    title_number: number;
}

export interface DashboardAnalyticsType {
    key_stats: { total_regs: number; avg_complexity: number; avg_amendments: number; total_word_count: number; total_unique_word_count: number };
    regs_by_agency: { id: number; agency: string; count: number; }[];
    complexity_over_time: { year: number; score: number; }[];
    trending_topics: string[];
}

export interface Agency {
    id: number;
    parent_id: number | null;
    name: string;
    short_name: string;
    display_name: string;
    sortable_name: string;
    slug: string;
    children?: Agency[];
}

export interface SearchResult {
    title_id: number;
    title_name: string;
    sections: {
        section_id: number;
        excerpt: string;
    }[];
}
