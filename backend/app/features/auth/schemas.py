from typing import Literal, Optional

from pydantic import BaseModel, Field


class GoogleStartRequest(BaseModel):
    next: Optional[str] = Field(None, description="Relative path to land on after login")
    app_redirect: Optional[str] = Field(None, description="Mobile deep link (must be allow-listed)")


class GoogleStartResponse(BaseModel):
    url: str
    state: str = Field(description="Client must keep this (cookie / memory) and send it back unchanged")


class GoogleCallbackRequest(BaseModel):
    code: str
    state: str


class SessionTokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: Literal["bearer"] = "bearer"
    user_id: str
    next: Optional[str] = None
    # Set for mobile logins: the web callback redirects to app_redirect?code=<otc>
    app_redirect: Optional[str] = None
    otc: Optional[str] = None


class TokenRequest(BaseModel):
    grant_type: Literal["refresh_token", "otc"]
    refresh_token: Optional[str] = None
    code: Optional[str] = None


class LogoutRequest(BaseModel):
    refresh_token: str


class DevLoginRequest(BaseModel):
    email: str
    full_name: Optional[str] = None


class EmailStartRequest(BaseModel):
    email: str = Field(max_length=254)
    password: Optional[str] = Field(None, max_length=128, description="Sign-up: the password to set once the code is confirmed")


class EmailVerifyRequest(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6)
    new_password: Optional[str] = Field(None, max_length=128, description="Forgot password: the new password")
    next: Optional[str] = Field(None, description="Relative path to land on after login")


class PasswordLoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)
    next: Optional[str] = Field(None, description="Relative path to land on after login")
