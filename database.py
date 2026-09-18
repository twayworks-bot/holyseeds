import os
import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import shutil

DATA_DIR = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.getenv("CATALOG_DB_PATH", os.path.join(DATA_DIR, "catalog.db"))

# If an older catalog.db exists at root and not yet in DATA_DIR, migrate it
legacy_db_path = os.path.join(os.path.dirname(__file__), "catalog.db")
if os.path.exists(legacy_db_path) and not os.path.exists(DB_PATH) and os.path.abspath(legacy_db_path) != os.path.abspath(DB_PATH):
    try:
        shutil.copy2(legacy_db_path, DB_PATH)
        print(f"[INFO] Migrated existing catalog.db from root to persistent {DB_PATH}")
    except Exception as e:
        print(f"[WARN] Failed to migrate existing catalog.db: {e}")

def get_db_connection() -> sqlite3.Connection:
    """Creates a database connection with dictionary-like row access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initializes the SQLite database and creates the necessary tables."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS app_catalog (
                    uuid TEXT PRIMARY KEY,
                    project TEXT NOT NULL,
                    production TEXT NOT NULL,
                    container_name TEXT,
                    name TEXT NOT NULL,
                    fqdn TEXT,
                    prefix TEXT,
                    status TEXT,
                    git_repository TEXT,
                    git_branch TEXT,
                    build_pack TEXT,
                    exposed_port TEXT,
                    coolify_created_at TEXT,
                    coolify_updated_at TEXT,
                    raw_data TEXT,
                    custom_title TEXT,
                    custom_description TEXT,
                    custom_image TEXT,
                    custom_icon TEXT,
                    synced_at TEXT,
                    last_seen_at TEXT,
                    is_active INTEGER DEFAULT 1
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_app_project ON app_catalog(project);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_app_production ON app_catalog(production);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_app_active ON app_catalog(is_active);")
    finally:
        conn.close()

def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Converts an SQLite row to a standardized dictionary for API responses."""
    d = dict(row)
    # Provide friendly fallback accessors
    d["title"] = d.get("custom_title") if d.get("custom_title") else d.get("name")
    d["description"] = d.get("custom_description") or ""
    d["image"] = d.get("custom_image") or ""
    d["icon"] = d.get("custom_icon") or ""
    return d

def get_all_apps_from_db(project: Optional[str] = None, production: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all active applications from the database, optionally filtered."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT * FROM app_catalog WHERE is_active = 1"
        params: List[Any] = []
        
        if project:
            query += " AND LOWER(project) = LOWER(?)"
            params.append(project)
        if production:
            query += " AND LOWER(production) = LOWER(?)"
            params.append(production)

        query += " ORDER BY CASE WHEN prefix = '/' THEN 0 ELSE 1 END, prefix ASC;"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()

def get_app_by_uuid(uuid: str) -> Optional[Dict[str, Any]]:
    """Fetches a single application by UUID from the database."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM app_catalog WHERE uuid = ?", (uuid,))
        row = cursor.fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()

def sync_applications_to_db(
    project_name: str,
    production_name: str,
    fetched_apps: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Synchronizes real-time Coolify applications with the SQLite database.
    - Records all extracted information (project, production, container_name, raw_data, etc.).
    - Compares incoming data with existing DB records and updates changed fields.
    - Preserves user-customized metadata (custom_title, custom_description, custom_image, custom_icon).
    - Sets is_active = 0 for apps that disappeared from Coolify in this sync round.
    """
    init_db()
    conn = get_db_connection()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        with conn:
            cursor = conn.cursor()
            
            # 1. Fetch current records in DB for this project & production
            cursor.execute(
                "SELECT uuid, status, fqdn, prefix, exposed_port, git_branch, git_repository, coolify_updated_at FROM app_catalog WHERE LOWER(project) = LOWER(?) AND LOWER(production) = LOWER(?)",
                (project_name, production_name)
            )
            existing_records = {row["uuid"]: dict(row) for row in cursor.fetchall()}
            
            current_seen_uuids = set()

            # 2. Iterate through fetched applications
            for app in fetched_apps:
                uuid = app.get("uuid")
                if not uuid:
                    continue
                current_seen_uuids.add(uuid)

                name = app.get("name") or "Unnamed"
                container_name = app.get("container_name") or app.get("uuid")
                fqdn = app.get("fqdn") or ""
                prefix = app.get("prefix") or "/"
                status = app.get("status") or "unknown"
                git_repo = app.get("git_repository")
                git_branch = app.get("git_branch", "main")
                build_pack = app.get("build_pack", "nixpacks")
                exposed_port = str(app.get("exposed_port") or app.get("ports_exposes") or "")
                coolify_created_at = app.get("created_at")
                coolify_updated_at = app.get("updated_at")
                raw_data = json.dumps(app.get("raw_data") or app, ensure_ascii=False)

                if uuid in existing_records:
                    # Compare and update
                    cursor.execute("""
                        UPDATE app_catalog
                        SET project = ?,
                            production = ?,
                            container_name = ?,
                            name = ?,
                            fqdn = ?,
                            prefix = ?,
                            status = ?,
                            git_repository = ?,
                            git_branch = ?,
                            build_pack = ?,
                            exposed_port = ?,
                            coolify_updated_at = ?,
                            raw_data = ?,
                            synced_at = ?,
                            last_seen_at = ?,
                            is_active = 1
                        WHERE uuid = ?;
                    """, (
                        project_name,
                        production_name,
                        container_name,
                        name,
                        fqdn,
                        prefix,
                        status,
                        git_repo,
                        git_branch,
                        build_pack,
                        exposed_port,
                        coolify_updated_at,
                        raw_data,
                        now_str,
                        now_str,
                        uuid
                    ))
                else:
                    # Insert brand new application
                    cursor.execute("""
                        INSERT INTO app_catalog (
                            uuid, project, production, container_name, name,
                            fqdn, prefix, status, git_repository, git_branch,
                            build_pack, exposed_port, coolify_created_at, coolify_updated_at,
                            raw_data, synced_at, last_seen_at, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
                    """, (
                        uuid,
                        project_name,
                        production_name,
                        container_name,
                        name,
                        fqdn,
                        prefix,
                        status,
                        git_repo,
                        git_branch,
                        build_pack,
                        exposed_port,
                        coolify_created_at,
                        coolify_updated_at,
                        raw_data,
                        now_str,
                        now_str
                    ))

            # 3. Mark apps that were not in this sync batch as inactive
            all_db_uuids = set(existing_records.keys())
            disappeared_uuids = all_db_uuids - current_seen_uuids
            for dis_uuid in disappeared_uuids:
                cursor.execute(
                    "UPDATE app_catalog SET is_active = 0, synced_at = ? WHERE uuid = ?",
                    (now_str, dis_uuid)
                )

        # 4. Return the refreshed list with custom metadata included
        return get_all_apps_from_db(project_name, production_name)
    finally:
        conn.close()

def update_app_metadata(
    uuid: str,
    custom_title: Optional[str] = None,
    custom_description: Optional[str] = None,
    custom_image: Optional[str] = None,
    custom_icon: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Updates the user-customizable metadata (TITLE, DESCRIPTION, IMAGE, ICON) for a specific app.
    Does not modify Coolify operational fields.
    """
    init_db()
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE app_catalog
                SET custom_title = ?,
                    custom_description = ?,
                    custom_image = ?,
                    custom_icon = ?
                WHERE uuid = ?;
            """, (
                custom_title.strip() if custom_title and custom_title.strip() else None,
                custom_description.strip() if custom_description and custom_description.strip() else None,
                custom_image.strip() if custom_image and custom_image.strip() else None,
                custom_icon.strip() if custom_icon and custom_icon.strip() else None,
                uuid
            ))
            if cursor.rowcount == 0:
                return None
        return get_app_by_uuid(uuid)
    finally:
        conn.close()
