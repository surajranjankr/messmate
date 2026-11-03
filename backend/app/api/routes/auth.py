from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import LoginRequest, TokenResponse, UserOut
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.repositories.user import IUserRepository
from app.dependencies.repositories import get_user_repository

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    user_repo: IUserRepository = Depends(get_user_repository)
):
    """Authenticate user with email and password via active repository backend."""
    user = await user_repo.get_by_email_with_password(request.email)

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
async def get_me(current_user: UserOut = Depends(get_current_user)):
    """Retrieve details of the currently authenticated user."""
    return current_user

@router.post("/logout")
async def logout(current_user: UserOut = Depends(get_current_user)):
    """Acknowledge user logout."""
    return {"message": "Logged out successfully"}
