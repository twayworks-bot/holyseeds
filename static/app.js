// State Management
let allApps = [];
let currentEditingApp = null;

// Keycloak Authentication State Management (auth_spec.md)
let authBaseUrl = "https://holyseeds.thewayworks.net/auth";
let currentUserAuth = {
    valid: false,
    is_manager: false,
    is_super: false,
    role_flag: "0",
    has_required_role: false,
    user: null
};

// Check if current user is Super Admin (manager flag == 2)
function isManagerFlag2() {
    return Boolean(
        currentUserAuth &&
        currentUserAuth.valid &&
        (currentUserAuth.role_flag === "2" || currentUserAuth.is_super === true)
    );
}

// List of high-quality premium linear gradients for procedurally generated application logos
const APP_GRADIENTS = [
    "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)", // Blue-Indigo
    "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)", // Emerald-Blue
    "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)", // Pink-Purple
    "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", // Orange-Red
    "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)", // Purple-Pink
    "linear-gradient(135deg, #06b6d4 0%, #10b981 100%)", // Cyan-Emerald
];

// Helper to determine gradient based on application name hashing
function getAppGradient(appName) {
    if (!appName) return APP_GRADIENTS[0];
    let hash = 0;
    for (let i = 0; i < appName.length; i++) {
        hash = appName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % APP_GRADIENTS.length;
    return APP_GRADIENTS[index];
}

// Helper to sanitize HTML strings
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper to construct GitHub URL from repo path
function getGithubUrl(repoPath) {
    if (!repoPath) return "#";
    if (repoPath.startsWith("http")) return repoPath;
    const cleanRepo = repoPath.replace(/\.git$/, "");
    return `https://github.com/${cleanRepo}`;
}

// Toast notification helper
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const iconClass = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Fetch instance configuration (Project & Production names)
async function fetchConfig() {
    try {
        const response = await fetch("/api/config");
        if (response.ok) {
            const config = await response.json();
            const titleElem = document.getElementById("catalog-title");
            const badgeElem = document.getElementById("env-badge");
            
            if (titleElem && config.project) {
                const projName = config.project.charAt(0).toUpperCase() + config.project.slice(1);
                titleElem.textContent = projName;
            }
            if (badgeElem && config.production) {
                badgeElem.textContent = config.production;
            }
            if (config.auth_url) {
                authBaseUrl = config.auth_url.replace(/\/+$/, "");
            }
        }
    } catch (e) {
        console.warn("Config fetch failed:", e);
    }
}

// Verify user authentication with Keycloak Auth Proxy (auth_spec.md)
async function verifyAuthStatus() {
    try {
        let authData = null;
        
        // 1. First attempt to check via backend endpoint /api/auth/verify (passes auth_session cookie)
        try {
            const res = await fetch("/api/auth/verify", {
                credentials: "include",
                headers: { "Accept": "application/json" }
            });
            if (res.ok) {
                authData = await res.json();
            }
        } catch (err) {
            console.warn("Backend auth verification endpoint failed, will attempt direct auth:", err);
        }

        // 2. If backend verification returned valid: false, attempt direct verification against authBaseUrl
        if (!authData || !authData.valid) {
            try {
                const directUrl = `${authBaseUrl}/api/verify-session?require_role=super`;
                const directRes = await fetch(directUrl, {
                    credentials: "include",
                    headers: { "Accept": "application/json" }
                });
                if (directRes.ok) {
                    const directData = await directRes.json();
                    if (directData && directData.valid) {
                        authData = directData;
                    }
                }
            } catch (directErr) {
                // Direct fetch might be blocked by CORS or network, keep previous result
            }
        }

        if (authData) {
            currentUserAuth = {
                valid: Boolean(authData.valid),
                is_manager: Boolean(authData.is_manager),
                is_super: Boolean(authData.is_super || authData.role_flag === "2" || authData.has_required_role),
                role_flag: String(authData.role_flag || "0"),
                has_required_role: Boolean(authData.has_required_role || authData.is_super || authData.role_flag === "2"),
                user: authData.user || null
            };
        } else {
            currentUserAuth = {
                valid: false,
                is_manager: false,
                is_super: false,
                role_flag: "0",
                has_required_role: false,
                user: null
            };
        }
    } catch (e) {
        console.error("Auth status verification failed:", e);
        currentUserAuth = { valid: false, is_manager: false, is_super: false, role_flag: "0", has_required_role: false, user: null };
    }

    renderAuthStatusUI();

    // If applications were already loaded, re-render catalog cards to reflect auth state changes
    if (allApps && allApps.length > 0) {
        const searchInput = document.getElementById("search-input");
        const query = (searchInput?.value || "").trim();
        if (query) {
            handleSearch({ target: { value: query } });
        } else {
            renderCatalog(allApps);
        }
    }
}

// Render Header Auth Status (Badge or Login button)
function renderAuthStatusUI() {
    const container = document.getElementById("auth-status-container");
    if (!container) return;

    const currentRedirect = encodeURIComponent(window.location.href);

    if (currentUserAuth.valid) {
        const userName = (currentUserAuth.user && (currentUserAuth.user.name || currentUserAuth.user.username)) || "사용자";
        if (isManagerFlag2()) {
            container.innerHTML = `
                <div class="auth-badge-box auth-manager" title="최고 관리자(manager flag=2)로 인증되었습니다. 상세 및 편집 기능이 활성화됩니다.">
                    <i class="fa-solid fa-shield-halved auth-icon"></i>
                    <span class="auth-user-name">${escapeHtml(userName)}</span>
                    <span class="auth-role-tag">flag=2</span>
                    <a href="${authBaseUrl}/logout" class="auth-action-link" title="로그아웃">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="auth-badge-box auth-general" title="일반 사용자(flag=${escapeHtml(currentUserAuth.role_flag)})로 로그인되었습니다. 편집 권한이 없습니다.">
                    <i class="fa-solid fa-user auth-icon"></i>
                    <span class="auth-user-name">${escapeHtml(userName)}</span>
                    <span class="auth-role-tag">flag=${escapeHtml(currentUserAuth.role_flag)}</span>
                    <a href="${authBaseUrl}/logout" class="auth-action-link" title="로그아웃">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </a>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <a href="${authBaseUrl}/login?redirect=${currentRedirect}&require_role=super" class="auth-login-link" title="최고 관리자(manager flag=2) 로그인">
                <i class="fa-solid fa-arrow-right-to-bracket"></i>
                <span>관리자 로그인</span>
            </a>
        `;
    }
}

// Fetch applications from the FastAPI backend & SQLite DB
async function fetchApplications() {
    const spinner = document.getElementById("loading-spinner");
    const grid = document.getElementById("catalog-grid");
    const emptyState = document.getElementById("no-results");
    const banner = document.getElementById("status-banner");

    spinner.style.display = "flex";
    grid.style.display = "none";
    emptyState.style.display = "none";
    banner.style.display = "none";

    try {
        const response = await fetch("/api/apps");
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP Error ${response.status}`);
        }
        allApps = await response.json();
        renderCatalog(allApps);
    } catch (error) {
        console.error("API Fetch Error:", error);
        spinner.style.display = "none";
        banner.className = "status-banner error";
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>동기화 오류:</strong> Coolify 정보를 불러올 수 없습니다. (${error.message})`;
        banner.style.display = "flex";
        
        document.querySelector("#stat-total .stat-value").textContent = "0";
        document.querySelector("#stat-running .stat-value").textContent = "0";
    }
}

// Generate single card HTML structure
function createCardElement(app, isPreview = false) {
    const card = document.createElement("div");
    card.className = "app-card";
    card.dataset.uuid = app.uuid;

    // Status formatting
    let statusClass = "unknown";
    let statusText = "확인불가";
    let dotClass = "dot-unknown";

    if (app.status && app.status.startsWith("running")) {
        statusClass = "running";
        dotClass = "dot-running";
        statusText = app.status.includes("healthy") ? "정상 작동" : "작동 중";
    } else if (app.status === "stopped" || app.status === "exited") {
        statusClass = "stopped";
        dotClass = "dot-stopped";
        statusText = "정지됨";
    }

    // Logo & Icon
    const bgGradient = getAppGradient(app.name);
    let logoInner = "";
    if (app.icon) {
        logoInner = `<i class="${escapeHtml(app.icon)} app-logo-custom-icon"></i>`;
    } else {
        const firstLetter = (app.title || app.name) ? (app.title || app.name).charAt(0).toUpperCase() : "?";
        logoInner = firstLetter;
    }

    // Route Subpath
    let prefixHtml = "";
    const displayFqdn = app.fqdn || "http://holyseeds.thewayworks.net";
    const cleanHost = displayFqdn.replace(/^https?:\/\//, "").split("/")[0];

    if (app.prefix === "/") {
        prefixHtml = `<span class="prefix-base">${cleanHost}</span><span class="prefix-sub">/</span>`;
    } else {
        prefixHtml = `<span class="prefix-base">${cleanHost}/</span><span class="prefix-sub">${escapeHtml(app.prefix)}</span>`;
    }

    // GitHub & Container info
    const repoDisplay = app.git_repository ? app.git_repository.split("/").pop().replace(".git", "") : "Private Repo";
    const githubUrl = getGithubUrl(app.git_repository);
    const containerDisplay = app.container_name || app.name || "container";

    const canEdit = !isPreview && isManagerFlag2();

    // Representative Image Banner
    let bannerHtml = "";
    if (app.image) {
        bannerHtml = `
            <div class="card-banner-wrapper ${canEdit ? "clickable-edit" : ""}" ${canEdit ? `onclick="openMetadataModal('${app.uuid}')" title="상세보기 및 편집"` : `onclick="window.open('${escapeHtml(app.fqdn)}', '_blank')"`}>
                <img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.title || app.name)}" class="card-banner-img" onerror="this.parentElement.style.display='none'">
                ${canEdit ? `<div class="card-banner-overlay"></div>` : ""}
            </div>
        `;
    }

    // Custom description block
    let descHtml = "";
    if (app.description) {
        descHtml = `<div class="app-description-box">${escapeHtml(app.description)}</div>`;
    }

    // Title and original name badge
    const displayTitle = app.title || app.name;
    let originalNameBadge = "";
    if (app.custom_title && app.custom_title !== app.name) {
        originalNameBadge = `<div class="app-original-badge" title="Coolify 원래 명칭"><i class="fa-solid fa-cube"></i> ${escapeHtml(app.name)}</div>`;
    }

    // Action button area (상세 및 편집 버튼은 manager flag=2인 경우에만 노출)
    let actionsHtml = "";
    if (!isPreview) {
        const hasManagerFlag2 = isManagerFlag2();
        const editBtnHtml = hasManagerFlag2 ? `
            <button type="button" class="btn btn-detail-edit" onclick="openMetadataModal('${app.uuid}')" title="웹앱 배포 상세정보 및 메타데이터 편집">
                <i class="fa-solid fa-sliders"></i> 상세 및 편집
            </button>
        ` : "";

        actionsHtml = `
            <div class="card-actions ${hasManagerFlag2 ? "" : "single-action"}">
                ${editBtnHtml}
                <a href="${escapeHtml(app.fqdn)}" target="_blank" rel="noopener noreferrer" class="btn btn-launch" title="웹 서비스 바로가기">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 바로가기
                </a>
            </div>
        `;
    }

    // Top-right edit button (하단 '상세 및 편집' 버튼과 기능이 동일하여 중복 노출 방지를 위해 비노출 처리)
    const editBtnHtml = "";

    card.innerHTML = `
        ${bannerHtml}
        <div class="card-body-content">
            <div class="card-top-row">
                <div class="card-top-left">
                    <div class="app-logo-container ${canEdit ? "clickable-edit" : ""}" style="background: ${bgGradient}" ${canEdit ? `onclick="openMetadataModal('${app.uuid}')" title="상세보기 및 편집"` : `onclick="window.open('${escapeHtml(app.fqdn)}', '_blank')"`}>
                        ${logoInner}
                    </div>
                    <div class="status-pill ${statusClass}">
                        <span class="status-dot ${dotClass}"></span>
                        <span>${statusText}</span>
                    </div>
                </div>
                <div class="card-top-right">
                    ${editBtnHtml}
                </div>
            </div>

            <div class="title-block">
                <h3 class="app-title ${canEdit ? "clickable-edit" : ""}" ${canEdit ? `onclick="openMetadataModal('${app.uuid}')" title="클릭하여 상세 정보 및 편집 열기"` : `onclick="window.open('${escapeHtml(app.fqdn)}', '_blank')"`}>
                    ${escapeHtml(displayTitle)}
                </h3>
                ${originalNameBadge}
            </div>

            ${descHtml}

            <div class="prefix-routing-info" title="접근 라우팅 주소">
                <i class="fa-solid fa-link" style="margin-right: 6px; color: var(--text-muted);"></i>
                ${prefixHtml}
            </div>

            <div class="meta-info-block">
                <div class="meta-item" title="도커 컨테이너 식별자">
                    <i class="fa-solid fa-box text-muted"></i>
                    <span class="git-pill container-pill">${escapeHtml(containerDisplay)}</span>
                </div>
                <div class="meta-item" title="Git 저장소">
                    <i class="fa-brands fa-github text-muted"></i>
                    ${app.git_repository ? `<a href="${githubUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(repoDisplay)}</a>` : `<span>Private Codebase</span>`}
                </div>
                <div class="meta-item">
                    <i class="fa-solid fa-code-branch text-muted"></i>
                    <div class="git-pills">
                        <span class="git-pill git-branch">${escapeHtml(app.git_branch || "main")}</span>
                        <span class="git-pill">${escapeHtml(app.build_pack || "nixpacks")}</span>
                        ${app.exposed_port ? `<span class="git-pill">Port: ${escapeHtml(app.exposed_port)}</span>` : ""}
                    </div>
                </div>
            </div>

            ${actionsHtml}
        </div>
    `;

    return card;
}

// Render catalog items and update statistics
function renderCatalog(apps) {
    const spinner = document.getElementById("loading-spinner");
    const grid = document.getElementById("catalog-grid");
    const emptyState = document.getElementById("no-results");
    
    spinner.style.display = "none";
    
    const totalCount = apps.length;
    const runningCount = apps.filter(app => app.status && app.status.startsWith("running")).length;
    
    document.querySelector("#stat-total .stat-value").textContent = totalCount;
    document.querySelector("#stat-running .stat-value").textContent = runningCount;

    if (totalCount === 0) {
        grid.style.display = "none";
        emptyState.style.display = "flex";
        return;
    }

    grid.style.display = "grid";
    emptyState.style.display = "none";
    grid.innerHTML = "";

    apps.forEach(app => {
        grid.appendChild(createCardElement(app));
    });
}

// Handle Real-time Search and Filtering
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    const clearBtn = document.getElementById("clear-search");

    if (query.length > 0) {
        clearBtn.style.display = "block";
    } else {
        clearBtn.style.display = "none";
    }

    const filtered = allApps.filter(app => {
        const nameMatch = app.name && app.name.toLowerCase().includes(query);
        const titleMatch = app.title && app.title.toLowerCase().includes(query);
        const descMatch = app.description && app.description.toLowerCase().includes(query);
        const prefixMatch = app.prefix && app.prefix.toLowerCase().includes(query);
        const containerMatch = app.container_name && app.container_name.toLowerCase().includes(query);
        const repoMatch = app.git_repository && app.git_repository.toLowerCase().includes(query);
        const branchMatch = app.git_branch && app.git_branch.toLowerCase().includes(query);
        
        return nameMatch || titleMatch || descMatch || prefixMatch || containerMatch || repoMatch || branchMatch;
    });

    renderFilteredCatalog(filtered);
}

function renderFilteredCatalog(filteredApps) {
    const grid = document.getElementById("catalog-grid");
    const emptyState = document.getElementById("no-results");

    if (filteredApps.length === 0) {
        grid.style.display = "none";
        emptyState.style.display = "flex";
        return;
    }

    grid.style.display = "grid";
    emptyState.style.display = "none";
    grid.innerHTML = "";

    filteredApps.forEach(app => {
        grid.appendChild(createCardElement(app));
    });
}

function clearSearch() {
    const searchInput = document.getElementById("search-input");
    searchInput.value = "";
    document.getElementById("clear-search").style.display = "none";
    searchInput.focus();
    renderCatalog(allApps);
}

// ==========================================================================
// METADATA & DETAIL MODAL FUNCTIONS
// ==========================================================================

function openMetadataModal(uuid) {
    if (!isManagerFlag2()) {
        showToast("접근 권한이 없습니다. '상세 및 편집' 기능은 manager flag=2(최고 관리자) 권한이 필요합니다.", "error");
        return;
    }

    const app = allApps.find(a => a.uuid === uuid);
    if (!app) return;

    currentEditingApp = app;

    // 1. Fill Header Information
    document.getElementById("edit-uuid").value = app.uuid;
    document.getElementById("modal-app-name").textContent = app.title || app.name;
    document.getElementById("modal-app-uuid").textContent = `UUID: ${app.uuid}`;

    const statusPill = document.getElementById("modal-status-pill");
    const statusText = document.getElementById("modal-status-text");
    if (app.status && app.status.startsWith("running")) {
        statusPill.className = "status-pill running";
        statusText.textContent = app.status.includes("healthy") ? "정상 가동" : "가동 중";
    } else {
        statusPill.className = "status-pill stopped";
        statusText.textContent = "정지됨";
    }

    // 2. Fill Left Column (System & Deployment Details)
    const fqdnLink = document.getElementById("detail-fqdn-link");
    fqdnLink.href = app.fqdn || "#";
    fqdnLink.textContent = app.fqdn || "-";

    document.getElementById("detail-prefix").textContent = app.prefix || "/";
    document.getElementById("detail-container").textContent = app.container_name || app.name || "-";
    document.getElementById("detail-project-env").textContent = `${app.project || "-"} / ${app.production || "-"}`;

    const gitLink = document.getElementById("detail-git-link");
    if (app.git_repository) {
        gitLink.href = getGithubUrl(app.git_repository);
        gitLink.textContent = app.git_repository;
    } else {
        gitLink.href = "#";
        gitLink.textContent = "비공개 저장소 (Private)";
    }

    document.getElementById("detail-branch").textContent = app.git_branch || "main";
    document.getElementById("detail-buildpack").textContent = app.build_pack || "nixpacks";
    document.getElementById("detail-port").textContent = app.exposed_port ? `Port ${app.exposed_port}` : "미지정";
    document.getElementById("detail-updated-at").textContent = app.updated_at || "-";
    document.getElementById("detail-synced-at").textContent = app.synced_at || "-";

    // 3. Fill Right Column (Metadata Editing Form)
    document.getElementById("edit-title").value = app.custom_title || "";
    document.getElementById("edit-description").value = app.custom_description || "";
    document.getElementById("edit-icon").value = app.custom_icon || "";
    document.getElementById("edit-image").value = app.custom_image || "";

    // Sync icon preview & preset highlights
    syncIconPreview(app.custom_icon || "");

    // Sync image preview
    syncImagePreview(app.custom_image || "");

    // Render live card preview
    updateLivePreview();

    // Show modal
    document.getElementById("metadata-modal").style.display = "flex";
}

function closeMetadataModal() {
    document.getElementById("metadata-modal").style.display = "none";
    currentEditingApp = null;
}

function syncIconPreview(iconClass) {
    const previewBox = document.getElementById("icon-preview-box");
    const cleanIcon = (iconClass || "").trim();
    if (cleanIcon) {
        previewBox.innerHTML = `<i class="${escapeHtml(cleanIcon)}"></i>`;
    } else {
        previewBox.innerHTML = `<i class="fa-solid fa-cube"></i>`;
    }

    document.querySelectorAll("#preset-icons .preset-btn").forEach(btn => {
        if (btn.dataset.icon === cleanIcon) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function syncImagePreview(imageUrl) {
    const wrapper = document.getElementById("image-preview-wrapper");
    const img = document.getElementById("image-preview-img");
    const cleanUrl = (imageUrl || "").trim();

    if (cleanUrl) {
        img.src = cleanUrl;
        wrapper.style.display = "block";
    } else {
        img.src = "";
        wrapper.style.display = "none";
    }
}

function updateLivePreview() {
    if (!currentEditingApp) return;

    const previewContainer = document.getElementById("modal-preview-card");
    const customTitle = document.getElementById("edit-title").value.trim();
    const customDesc = document.getElementById("edit-description").value.trim();
    const customIcon = document.getElementById("edit-icon").value.trim();
    const customImage = document.getElementById("edit-image").value.trim();

    const mockApp = {
        ...currentEditingApp,
        title: customTitle || currentEditingApp.name,
        custom_title: customTitle || null,
        description: customDesc,
        custom_description: customDesc || null,
        icon: customIcon,
        custom_icon: customIcon || null,
        image: customImage,
        custom_image: customImage || null
    };

    const previewEl = createCardElement(mockApp, true);
    previewContainer.innerHTML = previewEl.innerHTML;
    previewContainer.className = "app-card preview-card";
}

// Handle Image File Upload via API
async function handleFileUpload(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const imageInput = document.getElementById("edit-image");
    const originalPlaceholder = imageInput.placeholder;
    imageInput.value = "이미지 업로드 중...";
    imageInput.disabled = true;

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `업로드 실패 (${response.status})`);
        }

        const data = await response.json();
        imageInput.value = data.url;
        syncImagePreview(data.url);
        updateLivePreview();
        showToast("이미지가 persistent volume에 안전하게 업로드되었습니다.", "success");
    } catch (e) {
        console.error("Upload error:", e);
        imageInput.value = "";
        syncImagePreview("");
        showToast(`업로드 오류: ${e.message}`, "error");
    } finally {
        imageInput.disabled = false;
        imageInput.placeholder = originalPlaceholder;
    }
}

// Save Metadata changes to Backend API & SQLite DB
async function handleSaveMetadata(event) {
    event.preventDefault();
    if (!currentEditingApp) return;

    const uuid = currentEditingApp.uuid;
    const title = document.getElementById("edit-title").value.trim();
    const description = document.getElementById("edit-description").value.trim();
    const icon = document.getElementById("edit-icon").value.trim();
    const image = document.getElementById("edit-image").value.trim();

    const saveBtn = document.getElementById("modal-save-btn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;
    saveBtn.disabled = true;

    try {
        const response = await fetch(`/api/apps/${uuid}/metadata`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title || null,
                description: description || null,
                icon: icon || null,
                image: image || null
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `저장 실패 (${response.status})`);
        }

        const updatedApp = await response.json();

        // Update local state
        const idx = allApps.findIndex(a => a.uuid === uuid);
        if (idx !== -1) {
            allApps[idx] = updatedApp;
        }

        // Re-render catalog
        const query = document.getElementById("search-input").value.trim();
        if (query) {
            handleSearch({ target: { value: query } });
        } else {
            renderCatalog(allApps);
        }

        showToast(`'${updatedApp.title}' 메타데이터가 저장되었습니다.`, "success");
        closeMetadataModal();
    } catch (e) {
        console.error("Save error:", e);
        showToast(`저장 오류: ${e.message}`, "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Reset custom metadata to defaults
function handleResetMetadata() {
    if (!confirm("등록된 커스텀 메타데이터(명칭, 설명, 아이콘, 이미지)를 모두 초기화하시겠습니까?")) {
        return;
    }

    document.getElementById("edit-title").value = "";
    document.getElementById("edit-description").value = "";
    document.getElementById("edit-icon").value = "";
    document.getElementById("edit-image").value = "";

    syncIconPreview("");
    syncImagePreview("");
    updateLivePreview();
}

// Event Listeners Registration
document.addEventListener("DOMContentLoaded", async () => {
    // Initial fetch config, verify auth status & applications
    await fetchConfig();
    await verifyAuthStatus();
    await fetchApplications();

    // Search Box Bindings
    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", handleSearch);

    const clearBtn = document.getElementById("clear-search");
    clearBtn.addEventListener("click", clearSearch);

    // Refresh Button Binding
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.addEventListener("click", async () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        await verifyAuthStatus();
        await fetchApplications();
        showToast("Coolify API 및 DB 동기화가 완료되었습니다.", "success");
    });

    // Modal Events
    const modal = document.getElementById("metadata-modal");
    const closeBtn = document.getElementById("modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const form = document.getElementById("metadata-form");
    const resetBtn = document.getElementById("modal-reset-btn");

    closeBtn.addEventListener("click", closeMetadataModal);
    cancelBtn.addEventListener("click", closeMetadataModal);
    form.addEventListener("submit", handleSaveMetadata);
    resetBtn.addEventListener("click", handleResetMetadata);

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeMetadataModal();
        }
    });

    // Live update on input changes
    ["edit-title", "edit-description", "edit-icon", "edit-image"].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener("input", () => {
            if (id === "edit-icon") syncIconPreview(input.value);
            if (id === "edit-image") syncImagePreview(input.value);
            updateLivePreview();
        });
    });

    // Icon Presets Click Binding
    const presetContainer = document.getElementById("preset-icons");
    presetContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".preset-btn");
        if (!btn) return;
        const iconClass = btn.dataset.icon;
        document.getElementById("edit-icon").value = iconClass;
        syncIconPreview(iconClass);
        updateLivePreview();
    });

    // File Upload Binding
    const fileInput = document.getElementById("image-file-input");
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    // Remove Image Button
    const removeImgBtn = document.getElementById("remove-image-btn");
    removeImgBtn.addEventListener("click", () => {
        document.getElementById("edit-image").value = "";
        fileInput.value = "";
        syncImagePreview("");
        updateLivePreview();
    });
});
