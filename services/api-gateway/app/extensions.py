from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

jwt = JWTManager()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute"],
    storage_uri=None,  # Set via app config after init
)


# ── Shared auth-DB session for chat persistence ──────────────────────────────
_engine = None
_SessionLocal = None


def init_db(database_url: str) -> None:
    """Create the SQLAlchemy engine + session factory for the gateway.

    Gateway only reads/writes ``pipeline_messages`` here; all other tables
    remain owned by the auth-service.
    """
    global _engine, _SessionLocal
    _engine = create_engine(
        database_url, pool_pre_ping=True, pool_size=5, max_overflow=5
    )
    _SessionLocal = scoped_session(
        sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    )


def get_session():
    if _SessionLocal is None:
        raise RuntimeError("DB not initialised — call init_db() first")
    return _SessionLocal()
