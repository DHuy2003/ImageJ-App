"""
Article Search Service
Tìm kiếm bài báo khoa học từ 3 nguồn: PubMed, Semantic Scholar, CrossRef
Hợp nhất và chuẩn hóa kết quả về một định dạng JSON chung
"""

import aiohttp
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import re

# Base keywords cho cell biology research
BASE_KEYWORDS = [
    '"cell states" OR "cell cycle" OR "cell morphodynamic"',
    '"mitotic" OR "G1 phase" OR "G2 phase"'
]

# API URLs
PUBMED_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1"
CROSSREF_API = "https://api.crossref.org/works"
BIORXIV_API = "https://api.biorxiv.org/details/biorxiv"


@dataclass
class Article:
    """Unified article structure"""
    id: str
    title: str
    authors: List[str]
    abstract: str
    journal: str
    year: int
    citations: int
    doi: str
    url: str
    article_type: str  # 'Research Article', 'Review', 'Technical Report', 'Conference Paper'
    keywords: List[str]
    source: str  # 'pubmed', 'semantic_scholar', 'crossref'
    q_rank: str  # 'Q1', 'Q2', 'Q3', 'Q4', 'N/A'

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def build_search_query(user_keyword: str) -> str:
    """
    Xây dựng query: ưu tiên keyword người dùng trước, sau đó kết hợp base keywords
    Format: (user_keyword) AND (base_keywords) - user keyword là chính
    """
    base_query = " OR ".join(BASE_KEYWORDS)

    if user_keyword and user_keyword.strip():
        # User keyword ĐẦU TIÊN, sau đó mới kết hợp base keywords
        return f"({user_keyword.strip()}) AND ({base_query})"

    # Không có input thì dùng base keywords
    return base_query


def estimate_q_rank(citations: int, year: int) -> str:
    """
    Ước tính Q ranking dựa trên citations/year
    Q1: Top journals, high citations
    Q2: Good journals
    Q3: Average journals
    Q4: Lower tier journals
    """
    current_year = datetime.now().year
    age = max(1, current_year - year)
    citations_per_year = citations / age

    if citations_per_year >= 30:
        return 'Q1'
    elif citations_per_year >= 15:
        return 'Q2'
    elif citations_per_year >= 5:
        return 'Q3'
    elif citations_per_year >= 1:
        return 'Q4'
    else:
        return 'N/A'


def is_valid_article(title: str, article_type: str) -> bool:
    """
    Kiểm tra xem item có phải là article thực sự không
    Loại bỏ: figures, supplementary materials, corrections, etc.
    """
    title_lower = title.lower()

    # Patterns to exclude
    exclude_patterns = [
        'figure',
        'fig.',
        'supplementary',
        'supplement',
        'table s',
        'table ',
        'correction',
        'erratum',
        'corrigendum',
        'retraction',
        'author response',
        'peer review',
        'graphical abstract',
        'video abstract',
        'data availability'
    ]

    for pattern in exclude_patterns:
        if pattern in title_lower:
            return False

    # Title too short is suspicious
    if len(title) < 20:
        return False

    return True


def parse_pubmed_article(article: Dict) -> Optional[Article]:
    """Parse PubMed article từ JSON response"""
    uid = article.get('uid', article.get('pmid', ''))
    title = article.get('title', 'Unknown Title')

    # Filter out non-articles
    if not is_valid_article(title, 'Research Article'):
        return None

    year_str = article.get('pubdate', str(datetime.now().year))
    year_match = re.search(r'\d{4}', year_str)
    year = int(year_match.group()) if year_match else datetime.now().year

    citations = int(article.get('pmcrefcount', 0) or 0)

    # Extract DOI from elocationid
    doi = ''
    elocation = article.get('elocationid', '')
    if elocation and 'doi:' in elocation.lower():
        doi = elocation.replace('doi:', '').replace('doi: ', '').strip()

    return Article(
        id=f"pubmed_{uid}",
        title=title,
        authors=[a.get('name', '') for a in article.get('authors', [])],
        abstract=article.get('abstract', ''),
        journal=article.get('source', article.get('fulljournalname', '')),
        year=year,
        citations=citations,
        doi=doi,
        url=f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
        article_type='Research Article',
        keywords=[],
        source='pubmed',
        q_rank=estimate_q_rank(citations, year)
    )


def parse_semantic_scholar_article(paper: Dict) -> Optional[Article]:
    """Parse Semantic Scholar article"""
    paper_id = paper.get('paperId', '')
    title = paper.get('title', 'Unknown Title')

    # Determine article type
    pub_types = paper.get('publicationTypes', []) or []
    if 'Review' in pub_types:
        article_type = 'Review'
    elif 'Conference' in str(pub_types):
        article_type = 'Conference Paper'
    else:
        article_type = 'Research Article'

    # Filter out non-articles
    if not is_valid_article(title, article_type):
        return None

    year = paper.get('year') or datetime.now().year
    citations = paper.get('citationCount', 0) or 0

    # Get DOI
    external_ids = paper.get('externalIds', {}) or {}
    doi = external_ids.get('DOI', '')

    # Get journal name
    journal = paper.get('venue', '')
    if not journal and paper.get('journal'):
        journal = paper['journal'].get('name', '')

    return Article(
        id=f"ss_{paper_id}",
        title=title,
        authors=[a.get('name', '') for a in (paper.get('authors', []) or [])],
        abstract=paper.get('abstract', '') or '',
        journal=journal,
        year=year,
        citations=citations,
        doi=doi,
        url=paper.get('url', f"https://www.semanticscholar.org/paper/{paper_id}"),
        article_type=article_type,
        keywords=paper.get('fieldsOfStudy', []) or [],
        source='semantic_scholar',
        q_rank=estimate_q_rank(citations, year)
    )


def parse_crossref_article(item: Dict) -> Optional[Article]:
    """Parse CrossRef article"""
    doi = item.get('DOI', '')

    # Parse title first to check validity
    titles = item.get('title', ['Unknown Title'])
    title = titles[0] if titles else 'Unknown Title'

    # Determine article type
    item_type = item.get('type', '')
    if item_type == 'journal-article':
        article_type = 'Research Article'
    elif item_type == 'proceedings-article':
        article_type = 'Conference Paper'
    elif 'review' in item_type.lower():
        article_type = 'Review'
    else:
        article_type = 'Research Article'

    # Filter out non-articles
    if not is_valid_article(title, article_type):
        return None

    # Parse year
    published = item.get('published', {})
    date_parts = published.get('date-parts', [[datetime.now().year]])
    year = date_parts[0][0] if date_parts and date_parts[0] else datetime.now().year

    citations = item.get('is-referenced-by-count', 0) or 0

    # Parse authors
    authors = []
    for author in item.get('author', []):
        name = f"{author.get('given', '')} {author.get('family', '')}".strip()
        if name:
            authors.append(name)

    # Clean abstract (remove HTML tags)
    abstract = item.get('abstract', '') or ''
    abstract = re.sub(r'<[^>]+>', '', abstract)

    # Journal name
    container = item.get('container-title', [])
    journal = container[0] if container else ''

    return Article(
        id=f"crossref_{doi}",
        title=title,
        authors=authors,
        abstract=abstract,
        journal=journal,
        year=year,
        citations=citations,
        doi=doi,
        url=item.get('URL', f"https://doi.org/{doi}"),
        article_type=article_type,
        keywords=item.get('subject', []) or [],
        source='crossref',
        q_rank=estimate_q_rank(citations, year)
    )


async def search_pubmed(session: aiohttp.ClientSession, keyword: str, max_results: int = 20) -> List[Article]:
    """Tìm kiếm PubMed"""
    try:
        query = build_search_query(keyword)

        # Step 1: Search for IDs
        search_url = f"{PUBMED_API}/esearch.fcgi"
        params = {
            'db': 'pubmed',
            'term': query,
            'retmax': max_results,
            'retmode': 'json',
            'sort': 'relevance'
        }

        async with session.get(search_url, params=params) as resp:
            if resp.status != 200:
                return []
            search_data = await resp.json()

        ids = search_data.get('esearchresult', {}).get('idlist', [])
        if not ids:
            return []

        # Step 2: Get article details
        summary_url = f"{PUBMED_API}/esummary.fcgi"
        params = {
            'db': 'pubmed',
            'id': ','.join(ids),
            'retmode': 'json'
        }

        async with session.get(summary_url, params=params) as resp:
            if resp.status != 200:
                return []
            summary_data = await resp.json()

        results = summary_data.get('result', {})
        articles = []

        for uid in ids:
            if uid in results and isinstance(results[uid], dict):
                try:
                    article = parse_pubmed_article(results[uid])
                    if article:  # Only add valid articles
                        articles.append(article)
                except Exception as e:
                    print(f"Error parsing PubMed article {uid}: {e}")

        return articles

    except Exception as e:
        print(f"PubMed search error: {e}")
        return []


async def search_semantic_scholar(session: aiohttp.ClientSession, keyword: str, max_results: int = 20) -> List[Article]:
    """Tìm kiếm Semantic Scholar"""
    try:
        query = build_search_query(keyword)
        url = f"{SEMANTIC_SCHOLAR_API}/paper/search"
        params = {
            'query': query,
            'limit': max_results,
            'fields': 'paperId,title,authors,abstract,venue,year,citationCount,url,externalIds,publicationTypes,fieldsOfStudy,journal'
        }

        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()

        papers = data.get('data', []) or []
        articles = []

        for paper in papers:
            try:
                article = parse_semantic_scholar_article(paper)
                if article:  # Only add valid articles
                    articles.append(article)
            except Exception as e:
                print(f"Error parsing Semantic Scholar paper: {e}")

        return articles

    except Exception as e:
        print(f"Semantic Scholar search error: {e}")
        return []


async def search_crossref(session: aiohttp.ClientSession, keyword: str, max_results: int = 20) -> List[Article]:
    """Tìm kiếm CrossRef"""
    try:
        query = build_search_query(keyword)
        params = {
            'query': query,
            'rows': max_results,
            'select': 'DOI,title,author,abstract,container-title,published,is-referenced-by-count,URL,type,subject'
        }

        async with session.get(CROSSREF_API, params=params) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()

        items = data.get('message', {}).get('items', []) or []
        articles = []

        for item in items:
            try:
                article = parse_crossref_article(item)
                if article:  # Only add valid articles
                    articles.append(article)
            except Exception as e:
                print(f"Error parsing CrossRef article: {e}")

        return articles

    except Exception as e:
        print(f"CrossRef search error: {e}")
        return []


def parse_biorxiv_article(item: Dict) -> Optional[Article]:
    """Parse bioRxiv article"""
    doi = item.get('doi', '')
    title = item.get('title', 'Unknown Title')

    # Filter out non-articles
    if not is_valid_article(title, 'Preprint'):
        return None

    # Parse date to year
    date_str = item.get('date', '')
    year = datetime.now().year
    if date_str:
        year_match = re.search(r'\d{4}', date_str)
        if year_match:
            year = int(year_match.group())

    # bioRxiv doesn't provide citation count directly
    citations = 0

    # Parse authors
    authors_str = item.get('authors', '')
    authors = [a.strip() for a in authors_str.split(';') if a.strip()] if authors_str else []

    return Article(
        id=f"biorxiv_{doi}",
        title=title,
        authors=authors,
        abstract=item.get('abstract', '') or '',
        journal='bioRxiv (Preprint)',
        year=year,
        citations=citations,
        doi=doi,
        url=f"https://www.biorxiv.org/content/{doi}",
        article_type='Preprint',
        keywords=item.get('category', '').split(';') if item.get('category') else [],
        source='biorxiv',
        q_rank='N/A'  # Preprints don't have Q ranking
    )


async def search_biorxiv(session: aiohttp.ClientSession, keyword: str, max_results: int = 20) -> List[Article]:
    """
    Tìm kiếm bioRxiv
    bioRxiv API format: /details/biorxiv/{interval}/{cursor}
    Sử dụng content API để search
    """
    try:
        # bioRxiv content API for search
        # Format: https://api.biorxiv.org/details/biorxiv/2020-01-01/2024-12-31
        from datetime import timedelta

        # Search recent papers (last 2 years)
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')

        url = f"{BIORXIV_API}/{start_date}/{end_date}"

        async with session.get(url, params={'cursor': 0}) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()

        items = data.get('collection', []) or []
        articles = []

        # Filter by keyword in title or abstract
        keyword_lower = keyword.lower()
        for item in items:
            title = item.get('title', '').lower()
            abstract = item.get('abstract', '').lower()

            if keyword_lower in title or keyword_lower in abstract:
                try:
                    article = parse_biorxiv_article(item)
                    if article:
                        articles.append(article)
                        if len(articles) >= max_results:
                            break
                except Exception as e:
                    print(f"Error parsing bioRxiv article: {e}")

        return articles

    except Exception as e:
        print(f"bioRxiv search error: {e}")
        return []


async def search_all_sources_async(keyword: str, max_per_source: int = 20) -> Dict[str, Any]:
    """
    Tìm kiếm từ tất cả nguồn, hợp nhất và loại bỏ trùng lặp
    """
    async with aiohttp.ClientSession() as session:
        # Gọi 4 API song song (bao gồm bioRxiv)
        results = await asyncio.gather(
            search_pubmed(session, keyword, max_per_source),
            search_semantic_scholar(session, keyword, max_per_source),
            search_crossref(session, keyword, max_per_source),
            search_biorxiv(session, keyword, max_per_source),
            return_exceptions=True
        )

    pubmed_articles = results[0] if isinstance(results[0], list) else []
    ss_articles = results[1] if isinstance(results[1], list) else []
    crossref_articles = results[2] if isinstance(results[2], list) else []
    biorxiv_articles = results[3] if isinstance(results[3], list) else []

    # Hợp nhất và loại bỏ trùng lặp theo DOI hoặc title
    seen = set()
    all_articles = []

    def add_if_unique(article: Article):
        key = article.doi if article.doi else article.title.lower()[:50]
        if key not in seen:
            seen.add(key)
            all_articles.append(article)

    for article in pubmed_articles:
        add_if_unique(article)
    for article in ss_articles:
        add_if_unique(article)
    for article in crossref_articles:
        add_if_unique(article)
    for article in biorxiv_articles:
        add_if_unique(article)

    return {
        'articles': [a.to_dict() for a in all_articles],
        'total': len(all_articles),
        'sources': {
            'pubmed': len(pubmed_articles),
            'semantic_scholar': len(ss_articles),
            'crossref': len(crossref_articles)
        }
    }


def search_all_sources(keyword: str, max_per_source: int = 20) -> Dict[str, Any]:
    """
    Synchronous wrapper cho async search
    Được gọi từ Flask routes
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(search_all_sources_async(keyword, max_per_source))
        loop.close()
        return result
    except Exception as e:
        print(f"Search error: {e}")
        return {
            'articles': [],
            'total': 0,
            'sources': {'pubmed': 0, 'semantic_scholar': 0, 'crossref': 0},
            'error': str(e)
        }


def sort_articles(
    articles: List[Dict],
    sort_by: str = 'citations',
    sort_order: str = 'desc'
) -> List[Dict]:
    """Sắp xếp danh sách articles"""
    reverse = sort_order == 'desc'

    if sort_by == 'citations':
        return sorted(articles, key=lambda x: x.get('citations', 0), reverse=reverse)
    elif sort_by == 'year':
        return sorted(articles, key=lambda x: x.get('year', 0), reverse=reverse)
    elif sort_by == 'relevance':
        # Sort by Q rank (Q1 > Q2 > Q3 > Q4 > N/A)
        q_rank_order = {'Q1': 4, 'Q2': 3, 'Q3': 2, 'Q4': 1, 'N/A': 0}
        return sorted(articles, key=lambda x: q_rank_order.get(x.get('q_rank', 'N/A'), 0), reverse=reverse)

    return articles


def filter_articles_by_type(
    articles: List[Dict],
    article_type: Optional[str] = None
) -> List[Dict]:
    """Lọc articles theo loại"""
    if not article_type or article_type == 'All':
        return articles

    if article_type == 'Research':
        return [a for a in articles if a.get('article_type') in ['Research Article', 'Conference Paper']]
    elif article_type == 'Reviews':
        return [a for a in articles if a.get('article_type') in ['Review', 'Technical Report']]

    return articles
