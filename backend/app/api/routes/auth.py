from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserOut
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email and password, returning JWT access token."""
    email = request.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user or not verify_password(request.password, user.hashed_password):
        msg = (
            "Invalid email or password."
            if settings.ENVIRONMENT.lower() == "production"
            else "Invalid email or password. Use demo credentials (password: demo123)."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=msg,
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra_claims={"email": user.email, "displayName": user.display_name}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
            role=user.role,
            status=user.status,
        )
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve details of the currently authenticated user."""
    return UserOut(
        id=current_user.id,
        display_name=current_user.display_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Acknowledge user logout."""
    return {"message": "Logged out successfully"}
