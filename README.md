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
- Python 3.8 (required for cell-tracker-gnn compatibility)
- Conda (recommended for GPU support and complex dependencies)
- CUDA 11.1+ (optional, for GPU acceleration)

### Frontend Setup

```bash
cd front-end
npm install
npm run dev
```

### Backend Setup

#### Option 1: Basic Setup (Flask + Cellpose only)

This option is sufficient for basic image processing and cell segmentation using Cellpose.

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

#### Option 2: Full Setup with Cell-Tracker-GNN (Recommended)

This option includes the GNN-based cell tracking module with GPU support.

**Step 1: Create Conda Environment**

```bash
# Create conda environment with Python 3.8
conda create -n imagej-app python=3.8
conda activate imagej-app
```

**Step 2: Install PyTorch with CUDA Support**

```bash
# For CUDA 11.1 (recommended)
conda install pytorch==1.8.0 torchvision==0.9.0 cudatoolkit=11.1 -c pytorch -c conda-forge

# For CPU only
conda install pytorch==1.8.0 torchvision==0.9.0 cpuonly -c pytorch
```

**Step 3: Install PyTorch Geometric (PyG)**

```bash
# Install PyG and its dependencies
conda install pyg=2.0.1 -c pyg
# Or install components separately:
pip install torch-scatter torch-sparse torch-cluster torch-spline-conv -f https://data.pyg.org/whl/torch-1.8.0+cu111.html
pip install torch-geometric==2.0.1
```

**Step 4: Install FAISS (for feature similarity search)**

```bash
# GPU version
conda install faiss-gpu=1.7.2 -c conda-forge

# CPU version
conda install faiss-cpu=1.7.2 -c conda-forge
```

**Step 5: Install Flask Backend Dependencies**

```bash
cd back-end
pip install -r requirements.txt
```

**Step 6: Install Cell-Tracker-GNN Dependencies**

```bash
cd cell_tracker_gnn
pip install -r requirements.txt

# Additional dependencies
pip install pytorch-lightning==1.4.9
pip install hydra-core==1.1.0.dev5
pip install wandb
pip install opencv-python
```

**Step 7: (Optional) Install TensorFlow for Metric Learning**

```bash
# GPU version
conda install tensorflow-gpu=2.4.1 -c conda-forge

# CPU version
pip install tensorflow==2.4.1
```

**Step 8: Configure Environment**

```bash
cd back-end
cp .env.example .env
# Edit .env file as needed
```

**Step 9: Download Pretrained Models (Optional)**

Pretrained models for cell tracking are located in:
```
cell_tracker_gnn/models/pretrained/
```

Supported datasets: Fluo-C2DL-Huh7, Fluo-N2DH-SIM+, Fluo-N2DL-HeLa, PhC-C2DH-U373, DIC-C2DH-HeLa

**Step 10: Run the Server**

```bash
cd back-end
python app.py
```

### Cellpose Models

Cellpose supports the following pretrained models:
- `cyto` - Cytoplasm model (original)
- `cyto2` - Improved cytoplasm model
- `cyto3` - Latest cytoplasm model (default, recommended)
- `nuclei` - Nuclear segmentation model

Models are automatically downloaded on first use.

### Environment Summary

| Component | Python | Key Dependencies |
|-----------|--------|------------------|
| Flask Backend | 3.8+ | Flask, Cellpose, PyTorch, scikit-image |
| Cell-Tracker-GNN | 3.8 | PyTorch 1.8, PyG 2.0.1, PyTorch Lightning 1.4.9, FAISS |
| Metric Learning | 3.8 | TensorFlow 2.4.1, ResNet models |

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
