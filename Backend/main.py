from fastapi import FastAPI, Request
from Backend.database import Base, engine
from Backend.routes import auth
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from Backend.routes import medical_records, insurance_records, drug_records

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(medical_records.router)
app.include_router(insurance_records.router)
app.include_router(drug_records.router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0]
    msg = first_error.get("msg", "Invalid input data")
    return JSONResponse(
        status_code=400,
        content={"error": msg}
    )