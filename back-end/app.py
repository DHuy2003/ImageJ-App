from app import create_app
import atexit
from app.services.image_services import cleanup_folders

app = create_app()

atexit.register(cleanup_folders)

if __name__ == '__main__':
    app.run(debug=True)
