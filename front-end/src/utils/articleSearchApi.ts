import type { Article, ArticleSearchResult } from '../types/article';

const API_BASE_URL = "http://127.0.0.1:5000/api/articles";

/**
 * Tìm kiếm articles từ backend
 * Backend sẽ gọi 3 APIs (PubMed, Semantic Scholar, CrossRef) và hợp nhất kết quả
 * Sort/filter sẽ được thực hiện ở frontend để không cần gọi API lại
 */
export const searchAllSources = async (
    keyword: string
): Promise<ArticleSearchResult> => {
    try {
        const params = new URLSearchParams({
            keyword: keyword,
            max_per_source: '30'  // Lấy nhiều hơn để có đủ kết quả sau filter
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
                // Sort by Q rank
                const qRankOrder: Record<string, number> = { 'Q1': 4, 'Q2': 3, 'Q3': 2, 'Q4': 1, 'N/A': 0 };
                comparison = (qRankOrder[a.q_rank] || 0) - (qRankOrder[b.q_rank] || 0);
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
