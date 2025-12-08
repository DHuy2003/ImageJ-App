"""
Article Search Routes
API endpoints cho tìm kiếm bài báo khoa học
"""

from flask import Blueprint, request, jsonify
from app.services.article_service import (
    search_all_sources,
    sort_articles,
    filter_articles_by_type
)

article_bp = Blueprint('articles', __name__)


@article_bp.route('/search', methods=['GET'])
def search_articles():
    """
    Tìm kiếm bài báo từ 3 nguồn: PubMed, Semantic Scholar, CrossRef

    Query params:
        - keyword: từ khóa tìm kiếm (optional, mặc định dùng base keywords)
        - sort_by: citations | year | relevance (default: citations)
        - sort_order: asc | desc (default: desc)
        - filter_type: All | Research | Reviews (default: All)
        - max_per_source: số lượng tối đa mỗi nguồn (default: 20)

    Returns:
        JSON với structure:
        {
            "articles": [...],
            "total": int,
            "sources": {
                "pubmed": int,
                "semantic_scholar": int,
                "crossref": int
            }
        }
    """
    try:
        # Get query parameters
        keyword = request.args.get('keyword', '')
        sort_by = request.args.get('sort_by', 'citations')
        sort_order = request.args.get('sort_order', 'desc')
        filter_type = request.args.get('filter_type', 'All')
        max_per_source = int(request.args.get('max_per_source', 20))

        # Validate sort_by
        if sort_by not in ['citations', 'year', 'relevance']:
            sort_by = 'citations'

        # Validate sort_order
        if sort_order not in ['asc', 'desc']:
            sort_order = 'desc'

        # Limit max_per_source
        max_per_source = min(max(1, max_per_source), 50)

        # Search all sources
        result = search_all_sources(keyword, max_per_source)

        if 'error' in result:
            return jsonify({
                'error': result['error'],
                'articles': [],
                'total': 0,
                'sources': {'pubmed': 0, 'semantic_scholar': 0, 'crossref': 0}
            }), 500

        # Filter by type
        articles = filter_articles_by_type(result['articles'], filter_type)

        # Sort articles
        articles = sort_articles(articles, sort_by, sort_order)

        return jsonify({
            'articles': articles,
            'total': len(articles),
            'sources': result['sources'],
            'params': {
                'keyword': keyword,
                'sort_by': sort_by,
                'sort_order': sort_order,
                'filter_type': filter_type
            }
        })

    except Exception as e:
        return jsonify({
            'error': str(e),
            'articles': [],
            'total': 0
        }), 500


@article_bp.route('/sources', methods=['GET'])
def get_sources_info():
    """Trả về thông tin các nguồn dữ liệu đang sử dụng"""
    return jsonify({
        'sources': [
            {
                'name': 'PubMed',
                'id': 'pubmed',
                'description': 'NCBI PubMed - Thư viện y học quốc gia Mỹ',
                'url': 'https://pubmed.ncbi.nlm.nih.gov/'
            },
            {
                'name': 'Semantic Scholar',
                'id': 'semantic_scholar',
                'description': 'Allen AI Semantic Scholar - Công cụ tìm kiếm AI',
                'url': 'https://www.semanticscholar.org/'
            },
            {
                'name': 'CrossRef',
                'id': 'crossref',
                'description': 'CrossRef - Metadata từ các nhà xuất bản học thuật',
                'url': 'https://www.crossref.org/'
            }
        ],
        'base_keywords': [
            '"cell states" OR "cell cycle" OR "cell morphodynamic"',
            '"mitotic" OR "G1 phase" OR "G2 phase"'
        ]
    })
