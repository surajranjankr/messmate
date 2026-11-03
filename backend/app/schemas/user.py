from typing import Optional
from app.schemas.base import CamelModel

class UserBase(CamelModel):
    display_name: str
    email: str
    role: str  # STUDENT, VENDOR, ADMIN
    status: str = "ACTIVE"

class UserCreate(UserBase):
    password: Optional[str] = "demo123"

class UserUpdate(CamelModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserOut(UserBase):
    id: str

class UserInDB(UserBase):
    id: str
    hashed_password: str

class LoginRequest(CamelModel):
    email: str
    password: str

class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
