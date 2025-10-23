from flask import Flask
from flask_cors import CORS
from app.routes.image_routes import image_bp

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'your_secret_key_here'
    CORS(app)
    app.register_blueprint(image_bp, url_prefix='/api/images')

    print("✅ Blueprint /api/images đã được đăng ký!")   
    return app