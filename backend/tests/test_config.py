import os
import tempfile
import pytest
from pydantic_settings import SettingsConfigDict
from app.core.config import Settings, settings
from app.db.mongo import get_mongo_client


def test_sqlite_remains_default():
    """Verify that DATABASE_BACKEND defaults to 'sqlite' even when MONGODB_URI is loaded."""
    assert settings.DATABASE_BACKEND == "sqlite"
    assert settings.MONGODB_DATABASE == "messmate"


def test_atlas_credentials_loaded_without_exposing_value():
    """Verify that MONGODB_URI is populated from atlas-credentials.env without logging value."""
    # MONGODB_URI should be loaded and non-empty
    assert bool(settings.MONGODB_URI) is True
    assert isinstance(settings.MONGODB_URI, str)
    # Ensure it starts with mongodb protocol without printing or exposing anything else
    assert settings.MONGODB_URI.startswith("mongodb")


def test_environment_precedence():
    """
    Verify precedence order:
    1. Process environment variables (highest priority)
    2. backend/.env (overrides atlas-credentials.env)
    3. backend/atlas-credentials.env (supplies credentials when not overridden)
    """
    with tempfile.NamedTemporaryFile("w", delete=False) as atlas_file, \
         tempfile.NamedTemporaryFile("w", delete=False) as env_file:

        atlas_file.write("MONGODB_URI=mock://atlas-supplied-uri\nDATABASE_BACKEND=atlas_backend\n")
        atlas_path = atlas_file.name

        env_file.write("DATABASE_BACKEND=dotenv_backend\n")
        env_path = env_file.name

    try:
        class IsolatedSettings(Settings):
            model_config = SettingsConfigDict(
                env_file=(atlas_path, env_path),
                extra="ignore",
            )

        # Case A: dotenv overrides atlas-credentials.env for DATABASE_BACKEND,
        # but MONGODB_URI is supplied by atlas-credentials.env
        s1 = IsolatedSettings()
        assert s1.DATABASE_BACKEND == "dotenv_backend"
        assert s1.MONGODB_URI == "mock://atlas-supplied-uri"

        # Case B: Process env overrides everything
        os.environ["DATABASE_BACKEND"] = "process_env_override"
        os.environ["MONGODB_URI"] = "mock://process-env-uri"
        s2 = IsolatedSettings()
        assert s2.DATABASE_BACKEND == "process_env_override"
        assert s2.MONGODB_URI == "mock://process-env-uri"
    finally:
        os.environ.pop("DATABASE_BACKEND", None)
        os.environ.pop("MONGODB_URI", None)
        os.unlink(atlas_path)
        os.unlink(env_path)


def test_explicit_mongodb_selection():
    """Verify that MongoDB backend is activated only when explicitly configured."""
    custom_settings = Settings(DATABASE_BACKEND="mongodb")
    assert custom_settings.DATABASE_BACKEND == "mongodb"


def test_missing_credentials_produces_clear_error(monkeypatch):
    """Verify that missing MONGODB_URI raises a clear error when client connection is requested."""
    # Set MONGODB_URI to empty in settings
    monkeypatch.setattr(settings, "MONGODB_URI", "")
    with pytest.raises(ValueError) as excinfo:
        get_mongo_client()
    assert "MONGODB_URI is not configured" in str(excinfo.value)
