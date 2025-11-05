from app import db

class Image(db.Model):
    __tablename__ = 'imageJ'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(120), unique=True, nullable=False)
    filepath = db.Column(db.String(255), nullable=False)
    mask_filename = db.Column(db.String(120), nullable=True)
    mask_filepath = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default='original', nullable=False)
    last_edited_on = db.Column(db.DateTime, onupdate=db.func.now())
    uploaded_on = db.Column(db.DateTime, server_default=db.func.now())

    def __repr__(self):
        return f'<Image {self.filename}>'
