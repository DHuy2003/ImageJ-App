from app import create_app
import atexit
from app.services.image_file_services import cleanup_folders, cleanup_database
from app.extensions import db

app = create_app()

atexit.register(cleanup_folders)
atexit.register(cleanup_database, app=app)

with app.app_context():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if not inspector.has_table("imageJ"):
        db.create_all()
        print("Database & imageJ table are created!")
    else:
        print("imageJ table already existed.")

if __name__ == '__main__':
    app.run(debug=True)