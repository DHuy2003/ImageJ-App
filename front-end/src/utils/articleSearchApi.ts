import type { Article, ArticleSearchResult } from '../types/article';

const API_BASE_URL = "http://127.0.0.1:5000/api/articles";

/**
 * Tìm kiếm articles từ backend
 * Backend sẽ gọi 3 APIs (PubMed, Semantic Scholar, CrossRef) và hợp nhất kết quả
 */
export const searchAllSources = async (
    keyword: string,
    sortBy: 'citations' | 'year' | 'relevance' = 'citations',
    sortOrder: 'asc' | 'desc' = 'desc',
    filterType: 'All' | 'Research' | 'Reviews' = 'All'
): Promise<ArticleSearchResult> => {
    try {
        const params = new URLSearchParams({
            keyword: keyword,
            sort_by: sortBy,
            sort_order: sortOrder,
            filter_type: filterType,
            max_per_source: '20'
        });

        const response = await fetch(`${API_BASE_URL}/search?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Map backend response to frontend Article type
        const articles: Article[] = data.articles.map((a: any) => ({
            id: a.id,
            title: a.title,
            authors: a.authors || [],
            abstract: a.abstract || '',
            journal: a.journal || '',
            year: a.year,
            citations: a.citations || 0,
            rating: a.rating || 0,
            doi: a.doi || '',
            url: a.url || '',
            type: a.article_type || 'Research Article',
            keywords: a.keywords || [],
            source: a.source,
            q_rank: a.q_rank || 'N/A'
        }));

        return {
            articles,
            total: data.total,
            sources: data.sources
        };
    } catch (error) {
        console.error('Article search error:', error);
        return {
            articles: [],
            total: 0,
            sources: {
                pubmed: 0,
                semantic_scholar: 0,
                crossref: 0
            }
        };
    }
};

/**
 * Sort articles locally (nếu cần sort lại mà không gọi API)
 */
export const sortArticles = (
    articles: Article[],
    sortBy: 'citations' | 'year' | 'relevance',
    sortOrder: 'asc' | 'desc' = 'desc'
): Article[] => {
    const sorted = [...articles].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'citations':
                comparison = a.citations - b.citations;
                break;
            case 'year':
                comparison = a.year - b.year;
                break;
            case 'relevance':
                comparison = a.rating - b.rating;
                break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
};

/**
 * Filter articles by type locally
 */
export const filterArticlesByType = (
    articles: Article[],
    filterType: 'All' | 'Research' | 'Reviews'
): Article[] => {
    if (filterType === 'All') return articles;

    if (filterType === 'Research') {
        return articles.filter(a =>
            a.type === 'Research Article' || a.type === 'Conference Paper'
        );
    }

    if (filterType === 'Reviews') {
        return articles.filter(a =>
            a.type === 'Review' || a.type === 'Technical Report'
        );
    }

    return articles;
};

/**
 * Get sources info from backend
 */
export const getSourcesInfo = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/sources`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching sources info:', error);
        return null;
    }
};
