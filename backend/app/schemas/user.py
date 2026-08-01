import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole

# The roles a manager may hand out. `manager` is excluded so a farm cannot grow
# a second administrator by accident, and `admin` is reachable by no code path
# at all. Shared by creation and role change: if only one of the two enforced
# it, the other would be the way around it.
STAFF_ROLES = (UserRole.worker, UserRole.viewer)


def _assert_staff_role(v: UserRole) -> UserRole:
    if v not in STAFF_ROLES:
        raise ValueError("Role must be worker or viewer")
    return v


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    farm_name: str = Field(min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    farm_id: int

    model_config = {"from_attributes": True}


class UserCreateStaff(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v

    @field_validator("role")
    @classmethod
    def role_must_be_staff(cls, v: UserRole) -> UserRole:
        return _assert_staff_role(v)


class UserRoleUpdate(BaseModel):
    """The role, and only the role.

    Name, email and password stay with the account holder — a manager who can
    silently rewrite a colleague's email owns their sign-in.
    """

    role: UserRole

    @field_validator("role")
    @classmethod
    def role_must_be_staff(cls, v: UserRole) -> UserRole:
        return _assert_staff_role(v)
