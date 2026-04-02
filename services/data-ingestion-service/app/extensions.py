from pymongo import MongoClient


class MongoDB:
    """Lazy MongoDB connection, compatible with Flask app factory pattern."""

    def __init__(self):
        self._client = None
        self._db = None

    def init_app(self, app):
        self._client = MongoClient(app.config["MONGO_URL"])
        self._db = self._client[app.config["MONGO_DB"]]

    @property
    def db(self):
        if self._db is None:
            raise RuntimeError("MongoDB not initialized — call init_app() first")
        return self._db

    def get_collection(self, name: str):
        return self.db[name]


mongo = MongoDB()
