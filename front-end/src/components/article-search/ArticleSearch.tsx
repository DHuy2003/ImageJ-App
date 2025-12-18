import { useState, useMemo, useRef } from 'react';
import { Search, Calendar, ExternalLink, BookOpen, X, Loader2, Quote } from 'lucide-react';
import type { Article, ArticleSearchResult } from '../../types/article';
import { searchAllSources, sortArticles, filterArticlesByType } from '../../utils/articleSearchApi';
import './ArticleSearch.css';

interface ArticleSearchProps {
    isOpen: boolean;
    onClose: () => void;
}

type FilterType = 'All' | 'Research' | 'Reviews';
type SortType = 'citations' | 'year' | 'relevance';

const ArticleSearch = ({ isOpen, onClose }: ArticleSearchProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<ArticleSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');
    const [sortBy, setSortBy] = useState<SortType>('citations');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const hasSearched = useRef(false);

    // Chỉ gọi API khi search, không gọi lại khi sort/filter
    const handleSearch = async (keyword: string = searchQuery) => {
        if (!keyword.trim()) return;

        setLoading(true);
        hasSearched.current = true;

        try {
            // Gọi API một lần duy nhất, lấy tất cả kết quả
            const result = await searchAllSources(keyword);
            setSearchResult(result);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResult({ articles: [], total: 0, sources: { pubmed: 0, semantic_scholar: 0, crossref: 0 } });
        } finally {
            setLoading(false);
        }
    };

    // Sort locally - không gọi API
    const handleSortChange = (newSortBy: SortType) => {
        if (newSortBy === sortBy) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('desc');
        }
    };

    // Filter locally - không gọi API
    const handleFilterChange = (filter: FilterType) => {
        setActiveFilter(filter);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Filter và sort locally từ kết quả đã có
    const displayedArticles = useMemo(() => {
        if (!searchResult) return [];

        // Filter trước
        let articles = filterArticlesByType(searchResult.articles, activeFilter);

        // Sau đó sort
        articles = sortArticles(articles, sortBy, sortOrder);

        return articles;
    }, [searchResult, activeFilter, sortBy, sortOrder]);

    const getTypeColor = (type: Article['type']) => {
        switch (type) {
            case 'Research Article':
                return 'type-research';
            case 'Review':
                return 'type-review';
            case 'Conference Paper':
                return 'type-conference';
            default:
                return 'type-technical';
        }
    };

    const suggestedQueries = [
        'cell cycle regulation',
        'mitotic spindle',
        'cell migration',
        'apoptosis pathway',
        'stem cell differentiation'
    ];

    if (!isOpen) return null;

    return (
        <div className="article-search-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="article-search-panel">
                {/* Header */}
                <div className="article-search-header">
                    <div className="header-title">
                        <BookOpen size={20} />
                        <h2>Article Search</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search Input */}
                <div className="search-input-container">
                    <input
                        type="text"
                        placeholder="Enter keywords (e.g., cell cycle, mitosis, apoptosis...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <button
                        className="search-btn"
                        onClick={() => handleSearch()}
                        disabled={loading || !searchQuery.trim()}
                    >
                        {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                    </button>
                </div>

                {/* Suggested Queries */}
                {!hasSearched.current && (
                    <div className="suggested-queries">
                        <p>Suggested searches:</p>
                        <div className="query-tags">
                            {suggestedQueries.map((q, i) => (
                                <button key={i} onClick={() => { setSearchQuery(q); handleSearch(q); }}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filters & Sort */}
                {searchResult && (
                    <div className="filters-container">
                        <div className="filter-tabs">
                            {(['All', 'Research', 'Reviews'] as FilterType[]).map(filter => (
                                <button
                                    key={filter}
                                    className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
                                    onClick={() => handleFilterChange(filter)}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                        <div className="sort-options">
                            <span className="sort-label">Sort:</span>
                            {(['citations', 'year', 'relevance'] as SortType[]).map(sort => (
                                <button
                                    key={sort}
                                    className={`sort-btn ${sortBy === sort ? 'active' : ''}`}
                                    onClick={() => handleSortChange(sort)}
                                >
                                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                                    {sortBy === sort && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Count */}
                {searchResult && !loading && (
                    <div className="results-count">
                        Found <strong>{displayedArticles.length}</strong> articles
                        <span className="sources-info">
                            (PubMed: {searchResult.sources.pubmed},
                            Semantic Scholar: {searchResult.sources.semantic_scholar},
                            CrossRef: {searchResult.sources.crossref})
                        </span>
                    </div>
                )}

                {/* Results */}
                <div className="article-results">
                    {loading && (
                        <div className="loading-state">
                            <Loader2 className="spin" size={32} />
                            <p>Searching 3 databases...</p>
                        </div>
                    )}

                    {!loading && hasSearched.current && displayedArticles.length === 0 && (
                        <div className="no-results">
                            <BookOpen size={48} />
                            <p>No articles found</p>
                            <span>Try different keywords</span>
                        </div>
                    )}

                    {!loading && displayedArticles.length > 0 && (
                        <div className="articles-list">
                            {displayedArticles.map((article) => (
                                <div key={article.id} className="article-card">
                                    <div className="article-header">
                                        <h3 className="article-title">
                                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                                                {article.title}
                                                <ExternalLink size={12} />
                                            </a>
                                        </h3>
                                        <span className={`article-type ${getTypeColor(article.type)}`}>
                                            {article.type}
                                        </span>
                                    </div>

                                    <p className="article-authors">
                                        {article.authors.slice(0, 3).join(', ')}
                                        {article.authors.length > 3 && ' et al.'}
                                    </p>

                                    {article.abstract && (
                                        <p className="article-abstract">
                                            {article.abstract.length > 200
                                                ? article.abstract.substring(0, 200) + '...'
                                                : article.abstract}
                                        </p>
                                    )}

                                    <div className="article-footer">
                                        <div className="article-meta">
                                            <span className="meta-item">
                                                <Calendar size={14} />
                                                {article.year}
                                            </span>
                                            <span className="meta-item citations">
                                                <Quote size={14} />
                                                {article.citations.toLocaleString()} citations
                                            </span>
                                            <span className={`meta-item q-rank q-rank-${article.q_rank.toLowerCase().replace('/', '')}`}>
                                                {article.q_rank}
                                            </span>
                                        </div>
                                        <span className="article-journal">{article.journal}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="article-search-footer">
                    <span>Powered by PubMed, Semantic Scholar & CrossRef</span>
                </div>
            </div>
        </div>
    );
};

export default ArticleSearch;
