"""MongoDB extension — same shim used by data-ingestion-service.

Exposes `mongo.get_collection("name")` so the routes in this service can
share the call style of every other Python microservice in the platform.
Flask-PyMongo's own `PyMongo` exposes a `.db` attribute that you index
like a dict (`mongo.db["x"]`); we wrap that here behind a method so a
copy-paste from one service to another doesn't silently fail at runtime.
"""

from pymongo import MongoClient


class MongoDB:
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
