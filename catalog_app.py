import os
import urllib.parse
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from coolify_api import CoolifyAPI, CoolifyAPIError

app = FastAPI(title="Holyseeds Coolify Catalog API")

# Dynamically resolve project & environment IDs on startup or requests
class HolyseedsCatalog:
    def __init__(self):
        try:
            self.api = CoolifyAPI()
        except Exception as e:
            print(f"Error initializing Coolify API Client: {e}")
            self.api = None
            
        self.project_uuid = None
        self.environment_id = None

    def resolve_ids(self):
        """Finds and caches project and environment IDs for holyseeds production."""
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
            # Look for project named 'holyseeds' (case-insensitive)
            project = next((p for p in projects if p.get("name", "").lower() == "holyseeds"), None)
            if project:
                self.project_uuid = project.get("uuid")
                # Look for production environment
                envs = project.get("environments", [])
                prod_env = next((e for e in envs if e.get("name", "").lower() == "production"), None)
                if prod_env:
                    self.environment_id = prod_env.get("id")
                    print(f"✓ Resolved Project UUID: {self.project_uuid}, Environment ID: {self.environment_id}")
                    return True
                else:
                    # Fallback environment_id based on verification
                    self.environment_id = 3
                    print(f"✓ Resolved Project UUID: {self.project_uuid}, Environment ID fallback to 3")
                    return True
            else:
                # Absolute fallback if project query is limited
                self.project_uuid = "djrszzeyxx8l0hwk7gfgmxn9"
                self.environment_id = 3
                print("⚠️ Falling back to hardcoded Holyseeds production IDs")
                return True
        except Exception as e:
            print(f"⚠️ Exception during project resolution: {e}. Using hardcoded fallbacks.")
            self.project_uuid = "djrszzeyxx8l0hwk7gfgmxn9"
            self.environment_id = 3
            return True

catalog_service = HolyseedsCatalog()

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

@app.get("/api/status")
@app.get("/planning/api/status")
def get_status():
    """Health check status endpoint."""
    return {"status": "healthy"}

@app.get("/api/apps")
def get_catalog_applications():
    """Fetches, filters and formats Coolify applications for the holyseeds production domain."""
    if not catalog_service.resolve_ids():
        raise HTTPException(status_code=500, detail="Coolify API client could not be initialized.")

    try:
        apps = catalog_service.api.list_applications()
        filtered_apps = []

        for app_data in apps:
            # Check environment ID match (holyseeds production)
            env_id = app_data.get("environment_id")
            fqdn = app_data.get("fqdn") or ""
            
            # Check if app belongs to holyseeds production (id 3) AND serves on holyseeds.thewayworks.net
            if env_id == catalog_service.environment_id and "holyseeds.thewayworks.net" in fqdn.lower():
                prefix = parse_prefix(fqdn)
                
                # Format a clean dictionary
                filtered_apps.append({
                    "uuid": app_data.get("uuid"),
                    "name": app_data.get("name"),
                    "fqdn": fqdn,
                    "prefix": prefix,
                    "status": app_data.get("status", "unknown"),
                    "git_repository": app_data.get("git_repository"),
                    "git_branch": app_data.get("git_branch", "main"),
                    "build_pack": app_data.get("build_pack", "nixpacks"),
                    "exposed_port": app_data.get("ports_exposes"),
                    "updated_at": app_data.get("updated_at")
                })
                
        # Sort apps by prefix (root '/' first, then alphabetical)
        filtered_apps.sort(key=lambda x: ("" if x["prefix"] == "/" else x["prefix"].lower()))
        return filtered_apps
    except CoolifyAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Coolify API Error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected internal error: {str(e)}")

# Mount Static Files (Served at root '/')
# Ensure we create static directory first!
os.makedirs("static", exist_ok=True)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
