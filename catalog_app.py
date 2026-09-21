import os
import sys
import uuid as uuid_pkg
import urllib.parse

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
from typing import Any, Dict, List, Optional
import requests
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import database
from coolify_api import CoolifyAPI, CoolifyAPIError

# Load environment variables
load_dotenv()

app = FastAPI(title="Holyseeds Coolify Catalog API")

# Keycloak central authentication proxy base URL (auth_spec.md)
AUTH_URL = os.getenv("AUTH_URL", "https://holyseeds.thewayworks.net/auth").rstrip("/")

def verify_auth_session(request: Request) -> Dict[str, Any]:
    """
    Verifies user's session with Keycloak Auth Proxy according to auth_spec.md.
    Pattern 0: Super Admin / manager flag == '2'.
    """
    session_id = request.cookies.get("auth_session")
    if not session_id:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_id = auth_header.split(" ", 1)[1].strip()
        elif request.query_params.get("session_id"):
            session_id = request.query_params.get("session_id")

    if not session_id:
        return {
            "valid": False,
            "is_manager": False,
            "is_super": False,
            "role_flag": "0",
            "roles": [],
            "has_required_role": False,
            "error": "No session ID provided"
        }

    verify_url = f"{AUTH_URL}/api/verify-session"
    try:
        resp = requests.get(
            verify_url,
            params={"session_id": session_id, "require_role": "super"},
            cookies={"auth_session": session_id},
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            role_flag = str(data.get("role_flag", "0"))
            is_super = bool(data.get("is_super") or role_flag == "2" or data.get("has_required_role"))
            return {
                "valid": bool(data.get("valid")),
                "is_manager": bool(data.get("is_manager")),
                "is_super": is_super,
                "role_flag": role_flag,
                "roles": data.get("roles", []),
                "has_required_role": is_super,
                "user": data.get("user")
            }
    except Exception as e:
        print(f"[Auth Session Check] Error verifying session with {verify_url}: {e}")

    return {
        "valid": False,
        "is_manager": False,
        "is_super": False,
        "role_flag": "0",
        "roles": [],
        "has_required_role": False,
        "error": "Verification failed"
    }

# Pydantic schema for metadata update
class MetadataUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    icon: Optional[str] = None


class HolyseedsCatalog:
    def __init__(self):
        self.target_project = os.getenv("COOLIFY_PROJECT", "holyseeds")
        self.target_production = os.getenv("COOLIFY_PRODUCTION", "production")
        
        try:
            self.api = CoolifyAPI()
        except Exception as e:
            print(f"Error initializing Coolify API Client: {e}")
            self.api = None
            
        self.project_uuid = None
        self.environment_id = None

    def resolve_ids(self) -> bool:
        """Finds and caches project and environment IDs based on COOLIFY_PROJECT and COOLIFY_PRODUCTION."""
        # Refresh target values from env in case they changed
        self.target_project = os.getenv("COOLIFY_PROJECT", "holyseeds")
        self.target_production = os.getenv("COOLIFY_PRODUCTION", "production")

        if not self.api:
            try:
                self.api = CoolifyAPI()
            except Exception as e:
                print(f"Error re-initializing Coolify API Client: {e}")
                return False

        if self.project_uuid and self.environment_id:
            return True

        try:
            projects = self.api._request("GET", "projects")
            # Look for project matching target_project (case-insensitive)
            project = next((p for p in projects if p.get("name", "").strip().lower() == self.target_project.strip().lower()), None)
            if project:
                self.project_uuid = project.get("uuid")
                
                # Fetch detailed project to inspect environments
                proj_detail = self.api._request("GET", f"projects/{self.project_uuid}")
                envs = proj_detail.get("environments", [])
                
                prod_env = next((e for e in envs if e.get("name", "").strip().lower() == self.target_production.strip().lower()), None)
                if prod_env:
                    self.environment_id = prod_env.get("id")
                    print(f"[OK] Resolved Project: '{self.target_project}' ({self.project_uuid}), Environment: '{self.target_production}' (ID: {self.environment_id})")
                    return True
                else:
                    # If target is holyseeds and production, fallback ID is 3
                    if self.target_project.lower() == "holyseeds" and self.target_production.lower() == "production":
                        self.environment_id = 3
                        print(f"[INFO] Fallback Holyseeds Environment ID to 3")
                        return True
            else:
                # Absolute fallback if project query returned empty or unauthorized
                if self.target_project.lower() == "holyseeds" and self.target_production.lower() == "production":
                    self.project_uuid = "djrszzeyxx8l0hwk7gfgmxn9"
                    self.environment_id = 3
                    print("[WARN] Using hardcoded fallback Holyseeds production IDs")
                    return True
            return False
        except Exception as e:
            print(f"[WARN] Exception during project resolution: {e}. Attempting fallback.")
            if self.target_project.lower() == "holyseeds" and self.target_production.lower() == "production":
                self.project_uuid = "djrszzeyxx8l0hwk7gfgmxn9"
                self.environment_id = 3
                return True
            return False

catalog_service = HolyseedsCatalog()

# Initialize Database on startup
database.init_db()

def parse_prefix(fqdn: str) -> str:
    """Parses FQDN to extract the routing prefix/subpath."""
    if not fqdn:
        return ""
    try:
        parsed = urllib.parse.urlparse(fqdn)
        path = parsed.path.strip("/")
        return path if path else "/"
    except Exception:
        return "/"

# Ensure unified persistent data directory and uploads directory exist
DATA_DIR = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
os.makedirs(DATA_DIR, exist_ok=True)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(DATA_DIR, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Migrate any legacy files from static/uploads to DATA_DIR/uploads
legacy_upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
if os.path.exists(legacy_upload_dir) and os.path.abspath(legacy_upload_dir) != os.path.abspath(UPLOAD_DIR):
    for fname in os.listdir(legacy_upload_dir):
        src = os.path.join(legacy_upload_dir, fname)
        dst = os.path.join(UPLOAD_DIR, fname)
        if os.path.isfile(src) and not os.path.exists(dst):
            try:
                import shutil
                shutil.copy2(src, dst)
            except Exception:
                pass


@app.get("/api/status")
@app.get("/planning/api/status")
def get_status():
    """Health check status endpoint."""
    return {
        "status": "healthy",
        "project": catalog_service.target_project,
        "production": catalog_service.target_production
    }

@app.get("/api/auth/verify")
def api_verify_auth(request: Request):
    """
    Session verification endpoint called by frontend.
    Returns session validity, manager status, and manager flag=2 (is_super) status.
    """
    return verify_auth_session(request)

@app.get("/api/config")
def get_config():
    """Returns current project, production, instance, and auth gateway information."""
    return {
        "project": catalog_service.target_project,
        "production": catalog_service.target_production,
        "coolify_url": catalog_service.api.base_url if catalog_service.api else "",
        "auth_url": AUTH_URL
    }

@app.get("/api/apps")
def get_catalog_applications():
    """
    Fetches Coolify applications for the configured project/production environment,
    records all extracted information in the SQLite database, compares and updates changes,
    and returns the list merged with custom metadata.
    """
    catalog_service.resolve_ids()

    try:
        if not catalog_service.api:
            raise Exception("Coolify API client could not be initialized.")

        apps = catalog_service.api.list_applications()
        filtered_apps = []

        for app_data in apps:
            env_id = app_data.get("environment_id")
            fqdn = app_data.get("fqdn") or ""
            
            # Match application by resolved environment_id
            is_env_match = (env_id == catalog_service.environment_id) if catalog_service.environment_id else False

            # If environment ID could not be resolved, match by FQDN holyseeds domain
            if not is_env_match and catalog_service.target_project.lower() == "holyseeds":
                is_env_match = "holyseeds.thewayworks.net" in fqdn.lower()

            if is_env_match:
                prefix = parse_prefix(fqdn)
                container_name = app_data.get("container_name") or app_data.get("name") or app_data.get("uuid")

                filtered_apps.append({
                    "uuid": app_data.get("uuid"),
                    "name": app_data.get("name"),
                    "container_name": container_name,
                    "fqdn": fqdn,
                    "prefix": prefix,
                    "status": app_data.get("status", "unknown"),
                    "git_repository": app_data.get("git_repository"),
                    "git_branch": app_data.get("git_branch", "main"),
                    "build_pack": app_data.get("build_pack", "nixpacks"),
                    "exposed_port": app_data.get("ports_exposes"),
                    "created_at": app_data.get("created_at"),
                    "updated_at": app_data.get("updated_at"),
                    "raw_data": app_data
                })

        # Sync to SQLite DB (Upsert, compare changes, and retain custom metadata)
        synced_apps = database.sync_applications_to_db(
            catalog_service.target_project,
            catalog_service.target_production,
            filtered_apps
        )

        return synced_apps

    except Exception as e:
        print(f"[WARN] Coolify live sync failed ({str(e)}). Falling back to SQLite cached records.")
        cached_apps = database.get_all_apps_from_db(
            catalog_service.target_project,
            catalog_service.target_production
        )
        if cached_apps:
            return cached_apps
        raise HTTPException(status_code=500, detail=f"Failed to fetch apps and no cached data available: {str(e)}")

@app.get("/api/apps/{uuid}")
def get_app_details(uuid: str):
    """Retrieves details of a single application from SQLite DB."""
    app_data = database.get_app_by_uuid(uuid)
    if not app_data:
        raise HTTPException(status_code=404, detail=f"Application with UUID '{uuid}' not found.")
    return app_data

@app.post("/api/apps/{uuid}/metadata")
def update_application_metadata(uuid: str, req: MetadataUpdateRequest, request: Request):
    """
    Updates custom metadata (TITLE, DESCRIPTION, IMAGE, ICON) for an application.
    Protected: Only authenticated users with manager flag=2 (Super Admin) are permitted.
    """
    auth = verify_auth_session(request)
    is_manager_flag_2 = auth.get("valid") and (auth.get("role_flag") == "2" or auth.get("is_super") is True)
    if not is_manager_flag_2:
        raise HTTPException(
            status_code=403, 
            detail="권한이 없습니다. '상세 및 편집' 기능은 manager flag=2(최고 관리자) 권한이 필요합니다."
        )

    updated_app = database.update_app_metadata(
        uuid=uuid,
        custom_title=req.title,
        custom_description=req.description,
        custom_image=req.image,
        custom_icon=req.icon
    )
    if not updated_app:
        raise HTTPException(status_code=404, detail=f"Application with UUID '{uuid}' not found in database.")
    return updated_app

@app.post("/api/upload")
async def upload_image(request: Request, file: UploadFile = File(...)):
    """
    Handles user image uploads for custom card representative images.
    Saves to static/uploads and returns the web-accessible URL.
    Protected: Only authenticated users with manager flag=2 (Super Admin) are permitted.
    """
    auth = verify_auth_session(request)
    is_manager_flag_2 = auth.get("valid") and (auth.get("role_flag") == "2" or auth.get("is_super") is True)
    if not is_manager_flag_2:
        raise HTTPException(
            status_code=403, 
            detail="권한이 없습니다. 이미지 업로드는 manager flag=2(최고 관리자) 권한이 필요합니다."
        )

    allowed_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_extensions)}")

    # Generate unique filename
    unique_name = f"img_{uuid_pkg.uuid4().hex[:12]}{ext}"
    target_path = os.path.join(UPLOAD_DIR, unique_name)

    try:
        contents = await file.read()
        with open(target_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Return relative URL
    return {
        "status": "success",
        "url": f"/uploads/{unique_name}",
        "filename": unique_name
    }

# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")
