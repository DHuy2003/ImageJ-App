import { useState, useMemo, useRef } from 'react';
import { Search, Calendar, ExternalLink, BookOpen } from 'lucide-react';
import type { Article, ArticleSearchResult } from '../../types/article';
import { searchAllSources } from '../../utils/articleSearchApi';
import './ArticleSearch.css';

interface ArticleSearchProps {
    isActive: boolean;
}

type FilterType = 'All' | 'Research' | 'Reviews';
type SortType = 'citations' | 'year' | 'relevance';

const ArticleSearch = ({ isActive }: ArticleSearchProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<ArticleSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');
    const [sortBy, setSortBy] = useState<SortType>('citations');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const hasSearched = useRef(false);

    const handleSearch = async (
        keyword: string = searchQuery,
        sort: SortType = sortBy,
        order: 'asc' | 'desc' = sortOrder,
        filter: FilterType = activeFilter
    ) => {
        setLoading(true);
        hasSearched.current = true;
        try {
            // Gọi API backend với params sort và filter
            const result = await searchAllSources(keyword, sort, order, filter);
            setSearchResult(result);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Re-search khi thay đổi filter (nếu đã search trước đó)
    const handleFilterChange = (filter: FilterType) => {
        setActiveFilter(filter);
        if (hasSearched.current) {
            handleSearch(searchQuery, sortBy, sortOrder, filter);
        }
    };

    // Re-search khi thay đổi sort (nếu đã search trước đó)
    const handleSortChangeAndSearch = (newSortBy: SortType) => {
        let newOrder: 'asc' | 'desc' = 'desc';
        if (sortBy === newSortBy) {
            newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        }
        setSortBy(newSortBy);
        setSortOrder(newOrder);
        if (hasSearched.current) {
            handleSearch(searchQuery, newSortBy, newOrder, activeFilter);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Articles đã được sort và filter từ backend
    const displayedArticles = useMemo(() => {
        if (!searchResult) return [];
        return searchResult.articles;
    }, [searchResult]);


    const getTypeColor = (type: Article['type']) => {
        switch (type) {
            case 'Research Article':
                return 'type-research';
            case 'Review':
                return 'type-review';
            case 'Technical Report':
                return 'type-technical';
            case 'Conference Paper':
                return 'type-conference';
            default:
                return '';
        }
    };

    return (
        <div className={`article-search-container ${!isActive ? 'hidden' : ''}`}>
            {/* Search Header */}
            <div className="search-header">
                <div className="search-icon-wrapper">
                    <BookOpen size={20} />
                </div>
                <h3>Article Search</h3>
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper">
                <input
                    type="text"
                    placeholder="Search articles, keywords, authors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="search-input"
                />
                <button
                    className="search-btn"
                    onClick={() => handleSearch()}
                    disabled={loading}
                >
                    <Search size={18} />
                </button>
            </div>

            {/* Filter Tabs */}
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

            {/* Sort Options */}
            {searchResult && (
                <div className="sort-options">
                    <span className="sort-label">Sort by:</span>
                    <button
                        className={`sort-btn ${sortBy === 'citations' ? 'active' : ''}`}
                        onClick={() => handleSortChangeAndSearch('citations')}
                    >
                        Citations {sortBy === 'citations' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                    <button
                        className={`sort-btn ${sortBy === 'year' ? 'active' : ''}`}
                        onClick={() => handleSortChangeAndSearch('year')}
                    >
                        Year {sortBy === 'year' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                    <button
                        className={`sort-btn ${sortBy === 'relevance' ? 'active' : ''}`}
                        onClick={() => handleSortChangeAndSearch('relevance')}
                    >
                        Relevance {sortBy === 'relevance' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                </div>
            )}

            {/* Results Count */}
            {searchResult && (
                <div className="results-count">
                    Found <strong>{displayedArticles.length}</strong> articles
                    {searchResult.sources && (
                        <span className="sources-info">
                            (PubMed: {searchResult.sources.pubmed},
                            Semantic Scholar: {searchResult.sources.semantic_scholar},
                            CrossRef: {searchResult.sources.crossref})
                        </span>
                    )}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="loading-articles">
                    <div className="loading-spinner"></div>
                    <p>Searching across databases...</p>
                </div>
            )}

            {/* Articles List */}
            <div className="articles-list">
                {displayedArticles.map(article => (
                    <div key={article.id} className="article-card">
                        <div className="article-header">
                            <h4 className="article-title">{article.title}</h4>
                            <span className={`article-type ${getTypeColor(article.type)}`}>
                                {article.type}
                            </span>
                        </div>

                        <div className="article-authors">
                            <span className="author-icon">👤</span>
                            {article.authors.slice(0, 3).join(', ')}
                            {article.authors.length > 3 && `, +${article.authors.length - 3} more`}
                        </div>

                        {article.abstract && (
                            <p className="article-abstract">
                                {article.abstract.length > 200
                                    ? article.abstract.slice(0, 200) + '...'
                                    : article.abstract}
                            </p>
                        )}

                        <div className="article-keywords">
                            {article.keywords.slice(0, 4).map((keyword, idx) => (
                                <span key={idx} className="keyword-tag">{keyword}</span>
                            ))}
                            {article.keywords.length > 4 && (
                                <span className="keyword-more">+{article.keywords.length - 4}</span>
                            )}
                        </div>

                        <div className="article-footer">
                            <div className="article-meta">
                                <span className="meta-item">
                                    <Calendar size={14} />
                                    {article.year}
                                </span>
                                <span className={`meta-item q-rank q-rank-${article.q_rank.toLowerCase().replace('/', '')}`}>
                                    {article.q_rank}
                                </span>
                            </div>

                            <div className="article-journal">
                                {article.journal}
                            </div>

                            {article.url && (
                                <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="article-link"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {!loading && searchResult && displayedArticles.length === 0 && (
                <div className="empty-state">
                    <BookOpen size={48} />
                    <p>No articles found</p>
                    <span>Try different keywords or filters</span>
                </div>
            )}

            {/* Initial State */}
            {!loading && !searchResult && (
                <div className="initial-state">
                    <Search size={48} />
                    <p>Search for scientific articles</p>
                    <span>Enter keywords related to cell biology, microscopy, or your research topic</span>
                </div>
            )}
        </div>
    );
};

export default ArticleSearch;
