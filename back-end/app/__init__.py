from flask import Flask
from flask_cors import CORS
from app.extensions import db
from app.routes.image_file_routes import image_file_bp

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config.from_pyfile('config.py')
    db.init_app(app)

    app.register_blueprint(image_file_bp, url_prefix='/api/images')

    print("✅ Blueprint /api/images đã được đăng ký!")   
    return app