from flask import Flask
from flask_cors import CORS
from app.extensions import db
import os

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.config.from_pyfile('config.py')
    for key in ['UPLOAD_FOLDER', 'CONVERTED_FOLDER', 'MASK_FOLDER', 'EDITED_FOLDER']:
        os.makedirs(app.config[key], exist_ok=True)

    db.init_app(app)

    from app.routes.image_routes import image_bp
    app.register_blueprint(image_bp, url_prefix='/api/images')
    return app