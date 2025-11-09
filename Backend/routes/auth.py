# Backend/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from Backend.database import SessionLocal
from Backend.model import User
from Backend.schema import UserCreate, UserLogin
from Backend.auth_utils import create_access_token, verify_token

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
    argon2__time_cost=2,
    argon2__memory_cost=102400,
    argon2__parallelism=8,
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.national_id == user.national_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="National ID already registered")
    hashed_pw = pwd_context.hash(user.password)
    new_user = User(name=user.name, national_id=user.national_id, password=hashed_pw)
    db.add(new_user); db.commit(); db.refresh(new_user)
    return {"message": "Registered successfully!"}

@router.post("/login")
def login(payload: dict, response: Response, db: Session = Depends(get_db)):
    national_id = payload.get("national_id")
    password = payload.get("password")
    remember = bool(payload.get("remember", True))

    db_user = db.query(User).filter(User.national_id == national_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="National ID not found")
    if not pwd_context.verify(password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    if pwd_context.needs_update(db_user.password):
        db_user.password = pwd_context.hash(password); db.add(db_user); db.commit()

    token = create_access_token({"sub": db_user.national_id})

    # ✅ ضع التوكن في كوكي HttpOnly
    max_age = 60 * 60 * 24 * 7 if remember else 60 * 60  # أسبوع أو ساعة
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,          # اجعله True في الإنتاج مع HTTPS
        samesite="lax",
        max_age=max_age,
        path="/",
    )
    return {"ok": True}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@router.get("/me")
def me(request: Request):
    token = request.cookies.get("access_token")
    payload = verify_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"national_id": payload.get("sub")}
