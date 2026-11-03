"""
MessMate User Repository Interface
==================================
Defines contract for user retrieval, persistence, and state management
independent of underlying database engine (SQLite or MongoDB).
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.user import UserOut, UserInDB, UserCreate, UserUpdate


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[UserOut]:
        """Fetch active user by id without exposing password hash."""
        pass

    @abstractmethod
    async def get_by_email_with_password(self, email: str) -> Optional[UserInDB]:
        """Fetch user by email including hashed_password for auth verification."""
        pass

    @abstractmethod
    async def list_users(self) -> List[UserOut]:
        """List all registered users ordered by display_name."""
        pass

    @abstractmethod
    async def create_user(self, user_create: UserCreate) -> UserOut:
        """Create a new user with hashed password."""
        pass

    @abstractmethod
    async def update_user(self, user_id: str, updates: UserUpdate) -> Optional[UserOut]:
        """Update user properties."""
        pass

    @abstractmethod
    async def toggle_status(self, user_id: str) -> Optional[UserOut]:
        """Toggle user status between ACTIVE and INACTIVE."""
        pass
