# Backend/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from Backend.database import Base, engine
from Backend import model
from Backend.routes import (
    auth,
    medical_records,
    insurance_records,
    drug_records,
    notifications,   # ⬅️ أضفنا هذا
)
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

Base.metadata.create_all(bind=engine)

app = FastAPI()

# ✅ CORS للفرونت
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ⬅️ ربط جميع الراوترات
app.include_router(auth.router)
app.include_router(medical_records.router)
app.include_router(insurance_records.router)
app.include_router(drug_records.router)
app.include_router(notifications.router)  # ⬅️ هنا ربطنا الإشعارات

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0]
    msg = first_error.get("msg", "Invalid input data")
    return JSONResponse(status_code=400, content={"error": msg})
