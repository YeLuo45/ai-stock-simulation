"""SQLAlchemy database setup for simulated trading."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from config import settings

# Use aiosqlite for async support with SQLite
engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize all database tables."""
    from models import Portfolio, Position, Trade, StockCache, AIModelConfig, BacktestResult, AIModelPriority, DataSource
    Base.metadata.create_all(bind=engine)
    # Seed default data sources if empty
    _seed_data_sources()


def _seed_data_sources():
    """Seed default data sources."""
    from models import DataSource
    db = SessionLocal()
    try:
        existing = db.query(DataSource).count()
        if existing == 0:
            defaults = [
                DataSource(id="east_money", name="东方财富", enabled=True, priority=1),
                DataSource(id="tonghuashun", name="同花顺", enabled=True, priority=2),
                DataSource(id="joinquant", name="聚宽", enabled=True, priority=3),
            ]
            for ds in defaults:
                db.add(ds)
            db.commit()
    finally:
        db.close()
