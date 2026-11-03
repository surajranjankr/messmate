from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token
from app.schemas.user import UserOut
from app.repositories.user import IUserRepository
from app.dependencies.repositories import get_user_repository

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    user_repo: IUserRepository = Depends(get_user_repository)
) -> UserOut:
    """Retrieve and validate the authenticated user using the active repository backend."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_role(*allowed_roles: str):
    """Enforce role-based access control (RBAC) on endpoints."""
    def role_checker(current_user: UserOut = Depends(get_current_user)) -> UserOut:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: User role '{current_user.role}' is not authorized for this resource.",
            )
        return current_user
    return role_checker
