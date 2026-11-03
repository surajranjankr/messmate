"""
MessMate MongoDB User Repository Implementation
===============================================
Implements IUserRepository using Motor async driver against MongoDB Atlas.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status
from app.repositories.user import IUserRepository
from app.schemas.user import UserOut, UserInDB, UserCreate, UserUpdate
from app.core.security import hash_password


class MongoUserRepository(IUserRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.users

    async def get_by_id(self, user_id: str) -> Optional[UserOut]:
        doc = await self.collection.find_one({"_id": user_id, "status": "ACTIVE"})
        if not doc:
            return None
        return UserOut(
            id=doc["_id"],
            display_name=doc["display_name"],
            email=doc["email"],
            role=doc["role"],
            status=doc.get("status", "ACTIVE"),
        )

    async def get_by_email_with_password(self, email: str) -> Optional[UserInDB]:
        clean_email = email.strip().lower()
        doc = await self.collection.find_one(
            {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
        )
        if not doc:
            return None
        return UserInDB(
            id=doc["_id"],
            display_name=doc["display_name"],
            email=doc["email"],
            role=doc["role"],
            status=doc.get("status", "ACTIVE"),
            hashed_password=doc["hashed_password"],
        )

    async def list_users(self) -> List[UserOut]:
        cursor = self.collection.find({}).sort("display_name", 1)
        docs = await cursor.to_list(length=1000)
        return [
            UserOut(
                id=d["_id"],
                display_name=d["display_name"],
                email=d["email"],
                role=d["role"],
                status=d.get("status", "ACTIVE"),
            )
            for d in docs
        ]

    async def create_user(self, user_create: UserCreate) -> UserOut:
        clean_email = user_create.email.strip().lower()
        existing = await self.collection.find_one(
            {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        user_id = f"user-{uuid.uuid4().hex[:8]}"
        pwd = user_create.password or "demo123"
        now_iso = datetime.now(timezone.utc).isoformat()

        doc = {
            "_id": user_id,
            "display_name": user_create.display_name.strip(),
            "email": clean_email,
            "hashed_password": hash_password(pwd),
            "role": user_create.role.upper(),
            "status": user_create.status.upper(),
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await self.collection.insert_one(doc)

        return UserOut(
            id=user_id,
            display_name=doc["display_name"],
            email=doc["email"],
            role=doc["role"],
            status=doc["status"],
        )

    async def update_user(self, user_id: str, updates: UserUpdate) -> Optional[UserOut]:
        current = await self.collection.find_one({"_id": user_id})
        if not current:
            return None

        update_dict = {}
        if updates.display_name is not None:
            update_dict["display_name"] = updates.display_name.strip()
        if updates.email is not None:
            clean_email = updates.email.strip().lower()
            conflict = await self.collection.find_one(
                {
                    "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"},
                    "_id": {"$ne": user_id},
                }
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is in use by another account.",
                )
            update_dict["email"] = clean_email
        if updates.role is not None:
            update_dict["role"] = updates.role.upper()
        if updates.status is not None:
            update_dict["status"] = updates.status.upper()

        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            await self.collection.update_one({"_id": user_id}, {"$set": update_dict})

        updated_doc = await self.collection.find_one({"_id": user_id})
        return UserOut(
            id=updated_doc["_id"],
            display_name=updated_doc["display_name"],
            email=updated_doc["email"],
            role=updated_doc["role"],
            status=updated_doc.get("status", "ACTIVE"),
        )

    async def toggle_status(self, user_id: str) -> Optional[UserOut]:
        doc = await self.collection.find_one({"_id": user_id})
        if not doc:
            return None

        new_status = "INACTIVE" if doc.get("status") == "ACTIVE" else "ACTIVE"
        now_iso = datetime.now(timezone.utc).isoformat()
        await self.collection.update_one(
            {"_id": user_id},
            {"$set": {"status": new_status, "updated_at": now_iso}},
        )

        return UserOut(
            id=doc["_id"],
            display_name=doc["display_name"],
            email=doc["email"],
            role=doc["role"],
            status=new_status,
        )
