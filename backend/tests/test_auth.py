import pytest
from fastapi import status

def test_student_login_success(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "accessToken" in data or "access_token" in data
    assert data.get("tokenType", data.get("token_type")) == "bearer"
    assert data["user"]["role"] == "STUDENT"
    assert data["user"]["displayName"] == "Arjun Sharma"

def test_vendor_login_success(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "vendor@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["user"]["role"] == "VENDOR"

def test_admin_login_success(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["user"]["role"] == "ADMIN"

def test_login_invalid_password(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "arjun@iiitdwd.ac.in", "password": "wrongpassword"},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid" in res.json()["detail"].lower()

def test_login_unknown_email(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@iiitdwd.ac.in", "password": "demo123"},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED

def test_get_me_authenticated(client, student_auth_headers):
    res = client.get("/api/v1/auth/me", headers=student_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["email"] == "arjun@iiitdwd.ac.in"

def test_get_me_unauthorized_without_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED

def test_get_me_with_invalid_token(client):
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
