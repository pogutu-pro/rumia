"""Own Google sign-in + session tokens (replaces Supabase Auth)."""
from app.features.auth.router import router as auth_router

__all__ = ["auth_router"]
