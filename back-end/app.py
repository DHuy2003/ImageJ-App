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
    tables_created = []

    if not inspector.has_table("imageJ"):
        tables_created.append("imageJ")
    if not inspector.has_table("cell_features"):
        tables_created.append("cell_features")

    if tables_created:
        db.create_all()
        print(f"Database tables created: {', '.join(tables_created)}")
    else:
        print("All tables already exist.")

if __name__ == '__main__':
    app.run(debug=True)