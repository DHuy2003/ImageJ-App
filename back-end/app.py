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
        print("Database & imageJ table are created!")
    else:
        print("imageJ table already existed.")

atexit.register(cleanup_folders, app=app)

if __name__ == '__main__':
    app.run(debug=True)
