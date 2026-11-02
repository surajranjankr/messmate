import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.db.initialization import init_db
from app.main import app
from app.core.security import create_access_token

# Test database: isolated in-memory SQLite with static pool
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh isolated in-memory database for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    init_db(session)
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Override get_db with test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def student_auth_headers():
    token = create_access_token(subject="user-student-arjun", role="STUDENT")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def vendor_auth_headers():
    token = create_access_token(subject="user-vendor", role="VENDOR")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_auth_headers():
    token = create_access_token(subject="user-admin", role="ADMIN")
    return {"Authorization": f"Bearer {token}"}
