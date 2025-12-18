# ImageJ-App

A web-based image analysis application inspired by ImageJ, built with React and Flask. This application provides powerful tools for biological image processing, cell segmentation, feature extraction, clustering, and cell tracking.

## Features

- **Image Processing**: Upload, view, and manipulate biological images (supports TIFF and common formats)
- **Cell Segmentation**: Automatic cell segmentation using Cellpose deep learning model
- **Feature Extraction**: Extract cell features (area, perimeter, intensity, etc.)
- **Clustering Analysis**: K-means, Hierarchical, and DBSCAN clustering algorithms
- **Cell Tracking**: Track cells across time-lapse sequences using GNN-based tracker
- **ROI Tools**: Draw and manage regions of interest (rectangle, ellipse, polygon, brush)
- **Virtual Sequence**: Import and analyze image sequences
- **Article Search**: Search related research articles

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Axios
- Lucide React Icons
- React Router DOM

### Backend
- Flask (Python)
- Flask-SQLAlchemy
- Cellpose (cell segmentation)
- PyTorch
- scikit-image
- scikit-learn (clustering)
- HMM Learn
- SciPy

## Project Structure

```
ImageJ-App/
├── front-end/
│   └── src/
│       ├── components/
│       │   ├── analysis-results/
│       │   ├── article-search/
│       │   ├── brush-overlay/
│       │   ├── cell-features-table/
│       │   ├── clustering-dialog/
│       │   ├── crop-overlay/
│       │   ├── dropdown-menu/
│       │   ├── image-view/
│       │   ├── nav-bar/
│       │   ├── progress-dialog/
│       │   ├── roi-overlay/
│       │   ├── tool-bar/
│       │   └── virtual-sequence/
│       ├── pages/
│       ├── types/
│       ├── utils/
│       └── styles/
├── back-end/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── image_routes.py
│   │   │   └── article_routes.py
│   │   ├── services/
│   │   │   ├── image_services.py
│   │   │   ├── segmentation_services.py
│   │   │   ├── feature_extraction_services.py
│   │   │   ├── clustering_services.py
│   │   │   ├── tracking_services.py
│   │   │   └── article_service.py
│   │   └── models.py
│   ├── cell_tracker_gnn/
│   └── requirements.txt
└── README.md
```

## Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- pip

### Frontend Setup

```bash
cd front-end
npm install
npm run dev
```

### Backend Setup

```bash
cd back-end

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Run the server
python app.py
```

## Usage

1. Start the backend server (default: http://localhost:5000)
2. Start the frontend development server (default: http://localhost:5173)
3. Open browser and navigate to http://localhost:5173
4. Upload an image to begin analysis

## API Endpoints

### Image Routes
- `POST /api/upload` - Upload image
- `GET /api/image/<id>` - Get image by ID
- `POST /api/segment` - Run cell segmentation
- `POST /api/extract-features` - Extract cell features
- `POST /api/clustering` - Run clustering analysis
- `POST /api/tracking` - Run cell tracking

### Article Routes
- `GET /api/articles/search` - Search research articles

## Contributors

- DHuy2003
- Toan
- Tuan

## License

This project is for educational and research purposes.
