from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import SessionLocal
from model import User
from schema import UserCreate, UserLogin
router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    new_user = User(national_id=user.national_id, password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Registered successfully!"}


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.national_id == user.national_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="National ID not found")
    if not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    return {"message": "Login successful!"}
