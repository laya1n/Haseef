from pydantic import BaseModel, Field, validator

class UserCreate(BaseModel):
    name: str
    national_id: str = Field(..., description="Saudi National ID - must be 10 digits")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

    @validator("national_id")
    def validate_national_id(cls, v):
        if not v.isdigit():
            raise ValueError("National ID must contain only numbers")
        if len(v) != 10:
            raise ValueError("National ID must be exactly 10 digits")
        return v

    @validator("password")
    def validate_password(cls, v):
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        return v
    
class UserLogin(BaseModel):
    national_id: str
    password: str

    @validator("national_id")
    def validate_national_id(cls, v):
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Invalid National ID format")
        return v