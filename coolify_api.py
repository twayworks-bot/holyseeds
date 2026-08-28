import os
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

class CoolifyAPIError(Exception):
    """Exception raised for Coolify API errors."""
    def __init__(self, status_code: int, message: str, response_text: str = ""):
        super().__init__(f"API Error {status_code}: {message}")
        self.status_code = status_code
        self.message = message
        self.response_text = response_text


class CoolifyAPI:
    """API wrapper client for Coolify v1 API."""
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = (base_url or os.getenv("COOLIFY_URL") or "https://coolify.thewayworks.net").rstrip("/")
        # Ensure base_url has /api/v1 suffix
        if not self.base_url.endswith("/api/v1"):
            self.api_url = f"{self.base_url}/api/v1"
        else:
            self.api_url = self.base_url
            self.base_url = self.base_url.replace("/api/v1", "")

        self.token = token or os.getenv("COOLIFY_TOKEN")
        if not self.token:
            raise ValueError("Coolify token must be provided or configured in .env as COOLIFY_TOKEN")

        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _request(self, method: str, path: str, json_data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.api_url}/{path.lstrip('/')}"
        try:
            response = requests.request(method, url, headers=self.headers, json=json_data, params=params, timeout=30)
            if response.status_code in (200, 201, 202, 204):
                if response.status_code == 204:
                    return {"status": "success", "message": "No content returned"}
                try:
                    return response.json()
                except ValueError:
                    return {"status": "success", "text": response.text}
            else:
                try:
                    err_msg = response.json().get("message", response.reason)
                except ValueError:
                    err_msg = response.text or response.reason
                raise CoolifyAPIError(response.status_code, err_msg, response.text)
        except requests.RequestException as e:
            raise CoolifyAPIError(500, f"HTTP Connection Error: {str(e)}")

    # --- SERVERS ---
    def list_servers(self) -> List[Dict[str, Any]]:
        """List all servers."""
        return self._request("GET", "servers")

    def get_server(self, uuid: str) -> Dict[str, Any]:
        """Get details for a specific server."""
        return self._request("GET", f"servers/{uuid}")

    def get_server_resources(self, uuid: str) -> List[Dict[str, Any]]:
        """List all resources (apps, DBs, services) on a specific server."""
        return self._request("GET", f"servers/{uuid}/resources")

    # --- APPLICATIONS ---
    def list_applications(self) -> List[Dict[str, Any]]:
        """List all applications."""
        return self._request("GET", "applications")

    def get_application(self, uuid: str) -> Dict[str, Any]:
        """Get details for a specific application."""
        return self._request("GET", f"applications/{uuid}")

    def create_application_public(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new application from a public Git repository."""
        return self._request("POST", "applications/public", json_data=payload)

    def delete_application(self, uuid: str, delete_volumes: bool = False) -> Dict[str, Any]:
        """Delete an application."""
        params = {"delete_volumes": "true" if delete_volumes else "false"}
        return self._request("DELETE", f"applications/{uuid}", params=params)

    def start_application(self, uuid: str) -> Dict[str, Any]:
        """Start the application container."""
        return self._request("POST", f"applications/{uuid}/start")

    def stop_application(self, uuid: str) -> Dict[str, Any]:
        """Stop the application container."""
        return self._request("POST", f"applications/{uuid}/stop")

    def restart_application(self, uuid: str) -> Dict[str, Any]:
        """Restart the application container."""
        return self._request("POST", f"applications/{uuid}/restart")

    # --- SERVICES ---
    def list_services(self) -> List[Dict[str, Any]]:
        """List all services."""
        return self._request("GET", "services")

    def get_service(self, uuid: str) -> Dict[str, Any]:
        """Get details for a specific service."""
        return self._request("GET", f"services/{uuid}")

    def create_service(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new service (Docker Compose-based deployment)."""
        return self._request("POST", "services", json_data=payload)

    def delete_service(self, uuid: str) -> Dict[str, Any]:
        """Delete a service."""
        return self._request("DELETE", f"services/{uuid}")

    def start_service(self, uuid: str) -> Dict[str, Any]:
        """Start all containers in the service stack."""
        return self._request("POST", f"services/{uuid}/start")

    def stop_service(self, uuid: str) -> Dict[str, Any]:
        """Stop all containers in the service stack."""
        return self._request("POST", f"services/{uuid}/stop")

    def restart_service(self, uuid: str) -> Dict[str, Any]:
        """Restart the service stack."""
        return self._request("POST", f"services/{uuid}/restart")

    # --- DEPLOYMENTS ---
    def list_deployments(self) -> List[Dict[str, Any]]:
        """List all deployments."""
        return self._request("GET", "deployments")

    def get_deployment(self, uuid: str) -> Dict[str, Any]:
        """Get status/logs of a deployment."""
        return self._request("GET", f"deployments/{uuid}")

    def cancel_deployment(self, uuid: str) -> Dict[str, Any]:
        """Cancel a running deployment."""
        return self._request("POST", f"deployments/{uuid}/cancel")
