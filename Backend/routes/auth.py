from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from Backend.database import SessionLocal
from Backend.model import User
from Backend.schema import UserCreate, UserLogin
from Backend.auth_utils import create_access_token

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

    #password = user.password[:72]
    hashed_pw = pwd_context.hash(user.password)
    new_user = User(name=user.name, national_id=user.national_id, password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Registered successfully!"}


@router.post("/")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.national_id == user.national_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="National ID not found")
    if not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    access_token = create_access_token({"sub": db_user.national_id})
    return {"access_token": access_token, "token_type": "bearer"}
