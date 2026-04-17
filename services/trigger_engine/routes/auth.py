from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from functools import wraps

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

# 🛡️ Audit Logger Decorator
def audit_log(action: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Demo JWT Extraction
            auth_header = request.headers.get("Authorization")
            # In production, decode the JWT. For demo, we extract the signature or default.
            email = auth_header.split(" ")[1].split("_")[2] if auth_header and "mock_jwt" in auth_header else "admin@kavach.ai"
            
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            print(f"\n[AUDIT] - Admin {email} - Action: {action} - Timestamp: {timestamp}\n")
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

@router.post("/api/admin/login")
async def login(req: LoginRequest):
    if req.email == "admin@kavach.ai" and req.password == "admin123":
        # Return a demo-grade lightweight JWT token
        return {
            "access_token": f"mock_jwt_{req.email}_time_{int(datetime.utcnow().timestamp())}", 
            "token_type": "bearer"
        }
    
    raise HTTPException(status_code=401, detail="Invalid SOAR credentials")
