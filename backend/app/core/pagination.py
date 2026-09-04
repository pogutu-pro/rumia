from typing import Generic, List, TypeVar
from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        limit: int = Query(20, ge=1, le=1000, description="Items per page (max 1000)"),
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int = Field(..., json_schema_extra={"example": 100})
    page: int = Field(..., json_schema_extra={"example": 1})
    limit: int = Field(..., json_schema_extra={"example": 20})
    pages: int = Field(..., json_schema_extra={"example": 5})

    @classmethod
    def create(cls, items: List[T], total: int, page: int, limit: int) -> "PaginatedResponse[T]":
        pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(items=items, total=total, page=page, limit=limit, pages=pages)
