"""
MessMate SQLite User Repository Implementation
==============================================
Implements IUserRepository using SQLAlchemy 2.0 ORM over SQLite.
"""

import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.repositories.user import IUserRepository
from app.models.user import User
from app.schemas.user import UserOut, UserInDB, UserCreate, UserUpdate
from app.core.security import hash_password


class SqliteUserRepository(IUserRepository):
    def __init__(self, session: Session):
        self.session = session

    async def get_by_id(self, user_id: str) -> Optional[UserOut]:
        u = self.session.query(User).filter(User.id == user_id, User.status == "ACTIVE").first()
        if not u:
            return None
        return UserOut(
            id=u.id,
            display_name=u.display_name,
            email=u.email,
            role=u.role,
            status=u.status,
        )

    async def get_by_email_with_password(self, email: str) -> Optional[UserInDB]:
        clean_email = email.strip().lower()
        u = self.session.query(User).filter(User.email.ilike(clean_email)).first()
        if not u:
            return None
        return UserInDB(
            id=u.id,
            display_name=u.display_name,
            email=u.email,
            role=u.role,
            status=u.status,
            hashed_password=u.hashed_password,
        )

    async def list_users(self) -> List[UserOut]:
        users = self.session.query(User).order_by(User.display_name.asc()).all()
        return [
            UserOut(
                id=u.id,
                display_name=u.display_name,
                email=u.email,
                role=u.role,
                status=u.status,
            )
            for u in users
        ]

    async def create_user(self, user_create: UserCreate) -> UserOut:
        clean_email = user_create.email.strip().lower()
        existing = self.session.query(User).filter(User.email.ilike(clean_email)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        user_id = f"user-{uuid.uuid4().hex[:8]}"
        pwd = user_create.password or "demo123"
        new_user = User(
            id=user_id,
            display_name=user_create.display_name.strip(),
            email=clean_email,
            hashed_password=hash_password(pwd),
            role=user_create.role.upper(),
            status=user_create.status.upper(),
        )
        self.session.add(new_user)
        self.session.commit()
        self.session.refresh(new_user)

        return UserOut(
            id=new_user.id,
            display_name=new_user.display_name,
            email=new_user.email,
            role=new_user.role,
            status=new_user.status,
        )

    async def update_user(self, user_id: str, updates: UserUpdate) -> Optional[UserOut]:
        u = self.session.query(User).filter(User.id == user_id).first()
        if not u:
            return None

        if updates.display_name is not None:
            u.display_name = updates.display_name.strip()
        if updates.email is not None:
            clean_email = updates.email.strip().lower()
            conflict = self.session.query(User).filter(User.email.ilike(clean_email), User.id != user_id).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is in use by another account.",
                )
            u.email = clean_email
        if updates.role is not None:
            u.role = updates.role.upper()
        if updates.status is not None:
            u.status = updates.status.upper()

        self.session.commit()
        self.session.refresh(u)
        return UserOut(
            id=u.id,
            display_name=u.display_name,
            email=u.email,
            role=u.role,
            status=u.status,
        )

    async def toggle_status(self, user_id: str) -> Optional[UserOut]:
        u = self.session.query(User).filter(User.id == user_id).first()
        if not u:
            return None

        u.status = "INACTIVE" if u.status == "ACTIVE" else "ACTIVE"
        self.session.commit()
        self.session.refresh(u)
        return UserOut(
            id=u.id,
            display_name=u.display_name,
            email=u.email,
            role=u.role,
            status=u.status,
        )

    async def delete_user(self, user_id: str) -> bool:
        u = self.session.query(User).filter(User.id == user_id).first()
        if not u:
            return False
        self.session.delete(u)
        self.session.commit()
        return True
