from app import db

class Image(db.Model):
    __tablename__ = 'imageJ'

    session_id = db.Column(db.String(64), index=True, nullable=True)
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(120), nullable=True)
    filepath = db.Column(db.String(255), nullable=True)
    mask_filename = db.Column(db.String(120), nullable=True)
    mask_filepath = db.Column(db.String(255), nullable=True)
    edited_filepath = db.Column(db.String(255), nullable=True)
    excel_path = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default='original', nullable=False)
    last_edited_on = db.Column(db.DateTime, onupdate=db.func.now())
    uploaded_on = db.Column(db.DateTime, server_default=db.func.now())
    cell_features = db.relationship('CellFeature', backref='image', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Image {self.filename}>'


class CellFeature(db.Model):
    """Cell features extracted from segmentation masks for tracking"""
    __tablename__ = 'cell_features'

    id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, db.ForeignKey('imageJ.id'), nullable=False)
    cell_id = db.Column(db.Integer, nullable=False)  # Cell ID within the frame
    frame_num = db.Column(db.Integer, nullable=False)

    # Bounding box
    min_row_bb = db.Column(db.Integer, nullable=True)
    min_col_bb = db.Column(db.Integer, nullable=True)
    max_row_bb = db.Column(db.Integer, nullable=True)
    max_col_bb = db.Column(db.Integer, nullable=True)

    # Area and shape
    area = db.Column(db.Float, nullable=True)
    major_axis_length = db.Column(db.Float, nullable=True)
    minor_axis_length = db.Column(db.Float, nullable=True)

    # Centroid
    centroid_row = db.Column(db.Float, nullable=True)
    centroid_col = db.Column(db.Float, nullable=True)

    # Intensity
    max_intensity = db.Column(db.Float, nullable=True)
    mean_intensity = db.Column(db.Float, nullable=True)
    min_intensity = db.Column(db.Float, nullable=True)

    # Shape features
    convex_area = db.Column(db.Float, nullable=True)
    solidity = db.Column(db.Float, nullable=True)  # area / convex_area
    eccentricity = db.Column(db.Float, nullable=True)
    extent = db.Column(db.Float, nullable=True)  # area / bbox_area
    perimeter = db.Column(db.Float, nullable=True)
    circularity = db.Column(db.Float, nullable=True)  # 4 * pi * area / perimeter^2
    aspect_ratio = db.Column(db.Float, nullable=True)  # major_axis / minor_axis
    convexity_deficit = db.Column(db.Float, nullable=True)  # (convex_area - area) / convex_area

    # Intensity ratios
    intensity_ratio_max_mean = db.Column(db.Float, nullable=True)  # max_intensity / mean_intensity
    intensity_ratio_mean_min = db.Column(db.Float, nullable=True)  # mean_intensity / min_intensity

    # Motion features (computed after tracking)
    delta_x = db.Column(db.Float, nullable=True)  # displacement in x from previous frame
    delta_y = db.Column(db.Float, nullable=True)  # displacement in y from previous frame
    displacement = db.Column(db.Float, nullable=True)  # sqrt(delta_x^2 + delta_y^2)
    speed = db.Column(db.Float, nullable=True)  # same as displacement (velocity magnitude)
    turning = db.Column(db.Float, nullable=True)  # turning angle in radians

    # Tracking info (will be populated by cell-tracker-gnn)
    track_id = db.Column(db.Integer, nullable=True)  # Assigned track ID after tracking

    # Clustering states
    gmm_state = db.Column(db.Integer, nullable=True)  # GMM cluster assignment
    hmm_state = db.Column(db.Integer, nullable=True)  # HMM state after smoothing

    def __repr__(self):
        return f'<CellFeature frame={self.frame_num} cell={self.cell_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'image_id': self.image_id,
            'cell_id': self.cell_id,
            'frame_num': self.frame_num,
            'area': self.area,
            'min_row_bb': self.min_row_bb,
            'min_col_bb': self.min_col_bb,
            'max_row_bb': self.max_row_bb,
            'max_col_bb': self.max_col_bb,
            'centroid_row': self.centroid_row,
            'centroid_col': self.centroid_col,
            'major_axis_length': self.major_axis_length,
            'minor_axis_length': self.minor_axis_length,
            'max_intensity': self.max_intensity,
            'mean_intensity': self.mean_intensity,
            'min_intensity': self.min_intensity,
            # Shape features
            'convex_area': self.convex_area,
            'solidity': self.solidity,
            'eccentricity': self.eccentricity,
            'extent': self.extent,
            'perimeter': self.perimeter,
            'circularity': self.circularity,
            'aspect_ratio': self.aspect_ratio,
            'convexity_deficit': self.convexity_deficit,
            # Intensity ratios
            'intensity_ratio_max_mean': self.intensity_ratio_max_mean,
            'intensity_ratio_mean_min': self.intensity_ratio_mean_min,
            # Motion features
            'delta_x': self.delta_x,
            'delta_y': self.delta_y,
            'displacement': self.displacement,
            'speed': self.speed,
            'turning': self.turning,
            'track_id': self.track_id,
            # Clustering states
            'gmm_state': self.gmm_state,
            'hmm_state': self.hmm_state
        }
