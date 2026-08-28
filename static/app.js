// State Management
let allApps = [];

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

// Helper to construct GitHub URL from repo path
function getGithubUrl(repoPath) {
    if (!repoPath) return "#";
    // Check if it's already a full URL
    if (repoPath.startsWith("http")) return repoPath;
    
    // Clean .git extension and return github link
    const cleanRepo = repoPath.replace(/\.git$/, "");
    return `https://github.com/${cleanRepo}`;
}

// Fetch applications from the FastAPI backend
async function fetchApplications() {
    const spinner = document.getElementById("loading-spinner");
    const grid = document.getElementById("catalog-grid");
    const emptyState = document.getElementById("no-results");
    const banner = document.getElementById("status-banner");

    // Reset view to loading
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
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>API 오류:</strong> Coolify 정보를 불러올 수 없습니다. (${error.message})`;
        banner.style.display = "flex";
        
        // Update stats with zero
        document.querySelector("#stat-total .stat-value").textContent = "0";
        document.querySelector("#stat-running .stat-value").textContent = "0";
    }
}

// Render catalog items and update statistics
function renderCatalog(apps) {
    const spinner = document.getElementById("loading-spinner");
    const grid = document.getElementById("catalog-grid");
    const emptyState = document.getElementById("no-results");
    
    spinner.style.display = "none";
    
    // Calculate and update stats
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
        // Create Card Element
        const card = document.createElement("div");
        card.className = "app-card";
        
        // Determine Status Group
        let statusClass = "unknown";
        let statusText = "확인불가";
        let dotClass = "dot-unknown";

        if (app.status && app.status.startsWith("running")) {
            statusClass = "running";
            dotClass = "dot-running";
            // Map running:healthy or running:unknown nicely
            statusText = app.status.includes("healthy") ? "정상 작동" : "작동 중";
        } else if (app.status === "stopped" || app.status === "exited") {
            statusClass = "stopped";
            dotClass = "dot-stopped";
            statusText = "정지됨";
        }

        // Generate procedural style for Logo
        const bgGradient = getAppGradient(app.name);
        const firstLetter = app.name ? app.name.charAt(0).toUpperCase() : "?";

        // Construct Prefix Display
        let prefixHtml = "";
        if (app.prefix === "/") {
            prefixHtml = `<span class="prefix-base">holyseeds.thewayworks.net</span><span class="prefix-sub">/</span>`;
        } else {
            prefixHtml = `<span class="prefix-base">holyseeds.thewayworks.net/</span><span class="prefix-sub">${app.prefix}</span>`;
        }

        // Clean GitHub layout
        const repoDisplay = app.git_repository ? app.git_repository.split("/").pop().replace(".git", "") : "Private Repo";
        const githubUrl = getGithubUrl(app.git_repository);

        card.innerHTML = `
            <div class="card-top-row">
                <div class="app-logo-container" style="background: ${bgGradient}">
                    ${firstLetter}
                </div>
                <div class="status-pill ${statusClass}">
                    <span class="status-dot ${dotClass}"></span>
                    <span>${statusText}</span>
                </div>
            </div>

            <h3 class="app-name">${app.name}</h3>
            
            <div class="prefix-routing-info" title="접근 주소">
                <i class="fa-solid fa-link" style="margin-right: 6px; color: var(--text-muted);"></i>
                ${prefixHtml}
            </div>

            <div class="meta-info-block">
                <div class="meta-item" title="Git Repository">
                    <i class="fa-brands fa-github text-muted"></i>
                    ${app.git_repository ? `<a href="${githubUrl}" target="_blank" rel="noopener noreferrer">${repoDisplay}</a>` : `<span>Private Codebase</span>`}
                </div>
                <div class="meta-item">
                    <i class="fa-solid fa-code-branch text-muted"></i>
                    <div class="git-pills">
                        <span class="git-pill git-branch">${app.git_branch}</span>
                        <span class="git-pill">${app.build_pack}</span>
                        ${app.exposed_port ? `<span class="git-pill">Port: ${app.exposed_port}</span>` : ""}
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <a href="${app.fqdn}" target="_blank" rel="noopener noreferrer" class="btn-launch">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 서비스 바로가기
                </a>
            </div>
        `;
        grid.appendChild(card);
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
        const prefixMatch = app.prefix && app.prefix.toLowerCase().includes(query);
        const repoMatch = app.git_repository && app.git_repository.toLowerCase().includes(query);
        const branchMatch = app.git_branch && app.git_branch.toLowerCase().includes(query);
        
        return nameMatch || prefixMatch || repoMatch || branchMatch;
    });

    renderFilteredCatalog(filtered);
}

// Specialized render for filtered items (preserves stats but handles grid/empty states)
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
    
    // Clear only children that aren't matching or just re-render grid
    renderCatalogItemsOnly(filteredApps);
}

function renderCatalogItemsOnly(apps) {
    const grid = document.getElementById("catalog-grid");
    grid.innerHTML = "";

    apps.forEach(app => {
        const card = document.createElement("div");
        card.className = "app-card";
        
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

        const bgGradient = getAppGradient(app.name);
        const firstLetter = app.name ? app.name.charAt(0).toUpperCase() : "?";

        let prefixHtml = "";
        if (app.prefix === "/") {
            prefixHtml = `<span class="prefix-base">holyseeds.thewayworks.net</span><span class="prefix-sub">/</span>`;
        } else {
            prefixHtml = `<span class="prefix-base">holyseeds.thewayworks.net/</span><span class="prefix-sub">${app.prefix}</span>`;
        }

        const repoDisplay = app.git_repository ? app.git_repository.split("/").pop().replace(".git", "") : "Private Repo";
        const githubUrl = getGithubUrl(app.git_repository);

        card.innerHTML = `
            <div class="card-top-row">
                <div class="app-logo-container" style="background: ${bgGradient}">
                    ${firstLetter}
                </div>
                <div class="status-pill ${statusClass}">
                    <span class="status-dot ${dotClass}"></span>
                    <span>${statusText}</span>
                </div>
            </div>

            <h3 class="app-name">${app.name}</h3>
            
            <div class="prefix-routing-info" title="접근 주소">
                <i class="fa-solid fa-link" style="margin-right: 6px; color: var(--text-muted);"></i>
                ${prefixHtml}
            </div>

            <div class="meta-info-block">
                <div class="meta-item" title="Git Repository">
                    <i class="fa-brands fa-github text-muted"></i>
                    ${app.git_repository ? `<a href="${githubUrl}" target="_blank" rel="noopener noreferrer">${repoDisplay}</a>` : `<span>Private Codebase</span>`}
                </div>
                <div class="meta-item">
                    <i class="fa-solid fa-code-branch text-muted"></i>
                    <div class="git-pills">
                        <span class="git-pill git-branch">${app.git_branch}</span>
                        <span class="git-pill">${app.build_pack}</span>
                        ${app.exposed_port ? `<span class="git-pill">Port: ${app.exposed_port}</span>` : ""}
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <a href="${app.fqdn}" target="_blank" rel="noopener noreferrer" class="btn-launch">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 서비스 바로가기
                </a>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Clear Search input field
function clearSearch() {
    const searchInput = document.getElementById("search-input");
    searchInput.value = "";
    document.getElementById("clear-search").style.display = "none";
    searchInput.focus();
    renderCatalog(allApps);
}

// Event Listeners Registration
document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch
    fetchApplications();

    // Search Box Bindings
    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", handleSearch);

    // Clear Search Binding
    const clearBtn = document.getElementById("clear-search");
    clearBtn.addEventListener("click", clearSearch);

    // Refresh Button Binding
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.addEventListener("click", () => {
        // Clear search upon manual refresh
        searchInput.value = "";
        clearBtn.style.display = "none";
        fetchApplications();
    });
});
