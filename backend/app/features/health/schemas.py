from typing import Dict, Any
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "ok"})
    version: str = Field(..., json_schema_extra={"example": "1.0.0"})
    environment: str = Field(..., json_schema_extra={"example": "development"})
    services: Dict[str, Any] = Field(...)


class LivenessCheckResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "ok"})
