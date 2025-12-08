// Article types for scientific paper search

export type QRank = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'N/A';

export interface Article {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    journal: string;
    year: number;
    citations: number;
    rating: number; // 0-5 scale
    doi?: string;
    url?: string;
    type: 'Research Article' | 'Review' | 'Technical Report' | 'Conference Paper';
    keywords: string[];
    source: 'pubmed' | 'semantic_scholar' | 'crossref';
    q_rank: QRank; // Journal quartile ranking
}

export interface ArticleSearchParams {
    keyword: string;
    sortBy: 'citations' | 'year' | 'relevance';
    sortOrder: 'asc' | 'desc';
    filterType?: Article['type'];
}

export interface ArticleSearchResult {
    articles: Article[];
    total: number;
    sources: {
        pubmed: number;
        semantic_scholar: number;
        crossref: number;
    };
}

// Base keywords for cell biology research
export const BASE_KEYWORDS = [
    '"cell states" OR "cell cycle" OR "cell morphodynamic"',
    '"mitotic" OR "G1 phase" OR "G2 phase"'
];
