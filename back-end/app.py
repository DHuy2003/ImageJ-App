from app import create_app
import atexit
from app.services.image_file_services import cleanup_folders
from app.extensions import db

app = create_app()

with app.app_context():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if not inspector.has_table("imageJ"):
        db.create_all()
        print("Database và bảng imageJ đã được tạo!")
    else:
        print("Bảng imageJ đã tồn tại.")

atexit.register(cleanup_folders, app=app)

if __name__ == '__main__':
    app.run(debug=True)
