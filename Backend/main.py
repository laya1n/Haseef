from fastapi import FastAPI, Request
from Backend.database import Base, engine
from Backend.routes import auth
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth.router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0]
    msg = first_error.get("msg", "Invalid input data")
    return JSONResponse(
        status_code=400,
        content={"error": msg}
    )