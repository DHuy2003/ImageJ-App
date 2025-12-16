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

article_bp = Blueprint('article', __name__)


@article_bp.route('/search', methods=['GET'])
def search_articles():
    """
    Tìm kiếm bài báo từ 3 nguồn: PubMed, Semantic Scholar, CrossRef

    Query params:
        - keyword: từ khóa tìm kiếm (required)
        - sort_by: citations | year | relevance (default: citations)
        - sort_order: asc | desc (default: desc)
        - filter_type: All | Research | Reviews (default: All)
        - max_per_source: số kết quả tối đa mỗi nguồn (default: 20)
    """
    try:
        keyword = request.args.get('keyword', '').strip()
        sort_by = request.args.get('sort_by', 'citations')
        sort_order = request.args.get('sort_order', 'desc')
        filter_type = request.args.get('filter_type', 'All')
        max_per_source = int(request.args.get('max_per_source', 20))

        # Search all sources
        result = search_all_sources(keyword, max_per_source)

        if 'error' in result:
            return jsonify(result), 500

        # Filter by type
        articles = filter_articles_by_type(result['articles'], filter_type)

        # Sort articles
        articles = sort_articles(articles, sort_by, sort_order)

        return jsonify({
            'articles': articles,
            'total': len(articles),
            'sources': result['sources'],
            'query': {
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
def get_sources():
    """Lấy thông tin về các nguồn API"""
    return jsonify({
        'sources': [
            {
                'name': 'PubMed',
                'description': 'NCBI PubMed database - biomedical literature',
                'url': 'https://pubmed.ncbi.nlm.nih.gov/'
            },
            {
                'name': 'Semantic Scholar',
                'description': 'AI-powered research tool for scientific literature',
                'url': 'https://www.semanticscholar.org/'
            },
            {
                'name': 'CrossRef',
                'description': 'DOI registration agency with metadata for scholarly content',
                'url': 'https://www.crossref.org/'
            }
        ],
        'base_keywords': [
            'cell states', 'cell cycle', 'cell morphodynamic',
            'mitotic', 'G1 phase', 'G2 phase'
        ]
    })
