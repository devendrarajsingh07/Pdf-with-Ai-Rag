from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import hmac

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    if not hmac.compare_digest(credentials.credentials, settings.ml_service_token):
        raise HTTPException(status_code=401, detail="Invalid service token")
    return credentials.credentials
