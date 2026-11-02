import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserCreate, UserUpdate
from app.core.security import hash_password
from app.dependencies.auth import require_role

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN"))
):
    """List all registered users (Administrator access required)."""
    users = db.query(User).order_by(User.display_name.asc()).all()
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

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN"))
):
    """Add a new user (Administrator access required)."""
    email_clean = request.email.strip().lower()
    existing = db.query(User).filter(User.email.ilike(email_clean)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    pwd = request.password or "demo123"
    new_user = User(
        id=user_id,
        display_name=request.display_name.strip(),
        email=email_clean,
        hashed_password=hash_password(pwd),
        role=request.role.upper(),
        status=request.status.upper(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserOut(
        id=new_user.id,
        display_name=new_user.display_name,
        email=new_user.email,
        role=new_user.role,
        status=new_user.status,
    )

@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    request: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN"))
):
    """Update user details (Administrator access required)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if request.display_name is not None:
        user.display_name = request.display_name.strip()
    if request.email is not None:
        email_clean = request.email.strip().lower()
        conflict = db.query(User).filter(User.email.ilike(email_clean), User.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is in use by another account.")
        user.email = email_clean
    if request.role is not None:
        user.role = request.role.upper()
    if request.status is not None:
        user.status = request.status.upper()

    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        role=user.role,
        status=user.status,
    )

@router.patch("/{user_id}/status", response_model=UserOut)
def toggle_user_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN"))
):
    """Toggle user active / inactive status (Administrator access required)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.status = "INACTIVE" if user.status == "ACTIVE" else "ACTIVE"
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        role=user.role,
        status=user.status,
    )
