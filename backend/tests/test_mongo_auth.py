"""
MessMate MongoDB Authentication & User Repository Tests
=======================================================
Verifies that when DATABASE_BACKEND='mongodb', authentication, token issuance,
role authorization, and user profile retrieval work seamlessly against MongoDB Atlas
without modifying or corrupting existing migrated documents.
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import status
from app.main import app
from app.core.config import settings
from app.db.mongo import get_mongo_db
from app.repositories.mongodb.user import MongoUserRepository


@pytest.fixture(scope="module")
def mongo_client():
    """Test client configured explicitly for MongoDB backend."""
    orig_backend = settings.DATABASE_BACKEND
    settings.DATABASE_BACKEND = "mongodb"
    with TestClient(app) as test_client:
        yield test_client
    settings.DATABASE_BACKEND = orig_backend


@pytest.mark.asyncio
async def test_mongo_user_repository_direct():
    """Directly test MongoUserRepository methods against live Atlas cluster (read-only)."""
    db = get_mongo_db()
    repo = MongoUserRepository(db)

    # 1. Test get_by_email_with_password
    student = await repo.get_by_email_with_password("arjun@iiitdwd.ac.in")
    assert student is not None
    assert student.email == "arjun@iiitdwd.ac.in"
    assert student.role == "STUDENT"
    assert bool(student.hashed_password) is True

    # 2. Case-insensitivity test
    student_caps = await repo.get_by_email_with_password("ARJUN@IIITDWD.AC.IN")
    assert student_caps is not None
    assert student_caps.id == student.id

    # 3. Test get_by_id
    user_by_id = await repo.get_by_id(student.id)
    assert user_by_id is not None
    assert user_by_id.id == student.id
    assert hasattr(user_by_id, "hashed_password") is False or user_by_id.model_dump().get("hashed_password") is None

    # 4. Non-existent user
    non_existent = await repo.get_by_id("non-existent-id-999")
    assert non_existent is None

    # 5. List users
    users = await repo.list_users()
    assert len(users) >= 5
    emails = [u.email for u in users]
    assert "arjun@iiitdwd.ac.in" in emails
    assert "vendor@iiitdwd.ac.in" in emails
    assert "admin@iiitdwd.ac.in" in emails


def test_student_login_via_mongodb(mongo_client):
    """Verify Student login returns valid JWT and UserOut via MongoDB."""
    res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "accessToken" in data or "access_token" in data
    user = data["user"]
    assert user["email"] == "arjun@iiitdwd.ac.in"
    assert user["role"] == "STUDENT"
    assert "hashedPassword" not in user


def test_vendor_login_via_mongodb(mongo_client):
    """Verify Vendor login returns valid JWT and role VENDOR via MongoDB."""
    res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "vendor@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["user"]["role"] == "VENDOR"


def test_admin_login_via_mongodb(mongo_client):
    """Verify Admin login returns valid JWT and role ADMIN via MongoDB."""
    res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["user"]["role"] == "ADMIN"


def test_login_incorrect_password_rejected(mongo_client):
    """Verify invalid password returns HTTP 401 via MongoDB."""
    res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@iiitdwd.ac.in", "password": "wrong-password-999"},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in res.json()["detail"]


def test_login_unknown_user_rejected(mongo_client):
    """Verify unregistered email returns HTTP 401 via MongoDB."""
    res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "unknown-user@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in res.json()["detail"]


def test_get_me_user_profile_via_mongodb(mongo_client):
    """Verify /api/v1/auth/me resolves authenticated identity from MongoDB."""
    # First login to obtain token
    login_res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "priya@iiitdwd.ac.in", "password": "demo123"},
    )
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")

    # Fetch profile with Bearer token
    me_res = mongo_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == status.HTTP_200_OK
    profile = me_res.json()
    assert profile["email"] == "priya@iiitdwd.ac.in"
    assert profile["role"] == "STUDENT"


def test_rbac_student_forbidden_from_admin_users_list(mongo_client):
    """Verify that student token receives HTTP 403 when trying to access admin users list."""
    login_res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@iiitdwd.ac.in", "password": "demo123"},
    )
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")

    res = mongo_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_rbac_admin_allowed_users_list_via_mongodb(mongo_client):
    """Verify that admin token receives HTTP 200 and lists users from MongoDB Atlas."""
    login_res = mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@iiitdwd.ac.in", "password": "demo123"},
    )
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")

    res = mongo_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == status.HTTP_200_OK
    users = res.json()
    assert len(users) >= 5
    assert any(u["email"] == "vendor@iiitdwd.ac.in" for u in users)


def test_mongodb_unconfigured_produces_clear_503(monkeypatch):
    """Verify that if MongoDB is selected but MONGODB_URI is missing, a clear 503 is returned."""
    monkeypatch.setattr(settings, "DATABASE_BACKEND", "mongodb")
    monkeypatch.setattr(settings, "MONGODB_URI", "")
    with TestClient(app) as test_client:
        res = test_client.post(
            "/api/v1/auth/login",
            json={"email": "arjun@iiitdwd.ac.in", "password": "demo123"},
        )
        assert res.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "MONGODB_URI is not configured" in res.json()["detail"]
