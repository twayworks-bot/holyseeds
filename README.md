# Holyseeds Coolify 웹앱 카탈로그 (Catalog Web UI)

본 저장소는 **Coolify API v1**을 연동하여 지정된 프로젝트(`COOLIFY_PROJECT`)와 환경(`COOLIFY_PRODUCTION`) 하위에서 구동 중인 다양한 웹 애플리케이션들을 실시간 탐색하고, **통합 지속성 볼륨(`DATA_DIR`)의 SQLite DB에 동기화(Upsert)**하여 보존하며, 사용자가 직접 **명칭(TITLE)**, **설명(DESCRIPTION)**, **대표 이미지(IMAGE)**, **대표 아이콘(ICON)**을 커스터마이징하고 상세 운영 정보를 확인할 수 있는 **사용자 친화적 반응형 웹 카탈로그 시스템**입니다.

---

## 🌟 핵심 기능 (Key Features)

1. **`.env` 기반 동적 프로젝트 및 환경 연동**
   - `.env`에 설정된 `COOLIFY_PROJECT`(기본값: `holyseeds`)와 `COOLIFY_PRODUCTION`(기본값: `production`) 값을 기준으로 Coolify의 대상 프로젝트와 환경을 실시간 동적으로 매칭합니다.
   - Coolify API와 안전하게 통신하며, FQDN 주소에서 하위 라우팅 경로(Prefix)를 자동 파싱합니다.

2. **통합 Persistent Volume (`DATA_DIR`) 지원 (컨테이너 재시작 무손실 보장)**
   - 컨테이너가 새로 시작되거나 업데이트되더라도 **SQLite DB(`catalog.db`)**와 사용자가 **업로드한 이미지(`uploads/`)**가 영구 보존되도록 `DATA_DIR` 단일 환경변수 기반으로 저장 경로가 통합 관리됩니다.
   - Dockerfile에 `VOLUME ["/app/data"]`가 선언되어 단 하나의 볼륨 마운트(`-v holyseeds-data:/app/data`)만으로 데이터와 파일이 영구 유지됩니다.

3. **SQLite 데이터베이스 실시간 비교 및 동기화 (Sync & Upsert)**
   - Coolify API로부터 읽어온 웹앱 리스트를 로컬 SQLite DB(`$DATA_DIR/catalog.db`)의 `app_catalog` 테이블에 영구 기록합니다.
   - **전체 메타데이터 보존**: `PROJECT`, `PRODUCTION`, `CONTAINER NAME`, FQDN, 상태, Git 정보, 포트, 빌드팩 및 Coolify API의 원본 전체 데이터(`raw_data` JSON)를 모두 저장합니다.
   - **실시간 비교 갱신**: 실시간 읽어온 정보와 DB 레코드를 비교하여 변경된 상태/정보만 업데이트하고, Coolify 일시 장애 시 DB 캐시로 자동 대체(Fallback)하여 무중단 서비스를 제공합니다.
   - **커스텀 데이터 보존 보장**: Coolify 동기화가 반복 수행되어도 사용자가 등록한 커스텀 메타데이터는 절대 덮어씌워지지 않고 완벽하게 유지됩니다.

4. **웹앱 상세보기 및 사용자 편의 메타데이터 편집 (Detail & Custom Branding)**
   - **확실한 편집 진입로**: 각 카드 우측 상단의 **`[ ✏️ 편집 ]` 배지** 및 카드 하단의 **`[ ⚙️ 상세 및 편집 ]` 전용 버튼**, 카드 제목/배너 클릭을 통해 누구나 직관적으로 진입할 수 있습니다.
   - **종합 운영 정보 상세보기**: 실시간 가동 상태(정상/정지), FQDN 접속 링크, Prefix, Docker 컨테이너명, 프로젝트/환경, Git 저장소/브랜치, 빌드팩, 노출 포트, Coolify 갱신일시, DB 동기화 일시를 한눈에 확인합니다.
   - **TITLE (명칭)**: 서비스의 친화적 서비스명을 등록하여 카드 메인 타이틀로 우선 표시합니다.
   - **DESCRIPTION (설명)**: 웹 애플리케이션의 주요 용도와 안내 문구를 등록하여 카드 본문에 표시합니다.
   - **ICON (대표 아이콘)**: FontAwesome 클래스 직접 입력 또는 12종 추천 프리셋(예배, 일정, 모바일, 보안, 나눔 등)을 원클릭 선택합니다.
   - **IMAGE (대표 이미지)**: **내 PC에서 이미지 파일 직접 업로드**(`$DATA_DIR/uploads/`에 저장) 또는 외부 웹 이미지 URL을 등록하여 미려한 배너를 생성합니다.
   - **실시간 라이브 프리뷰**: 모달 내에서 입력 즉시 카드가 어떻게 보일지 실시간으로 확인하고 저장할 수 있습니다.

5. **모던한 디자인 및 뛰어난 인터랙션 (Vanilla CSS & JS)**
   - **가동 상태 실시간 트래킹**: 컨테이너 정상 가동 여부에 따라 생동감 있는 **Pulsing Green Dot** 애니메이션이 표시됩니다.
   - **인스턴트 통합 검색**: 명칭, 설명, 컨테이너명, 하위 경로(Prefix), Git 레포지토리, 브랜치명을 실시간 필터링합니다.
   - **원터치 새로고침**: 백엔드를 거쳐 Coolify 및 SQLite DB 동기화를 원터치로 갱신합니다.
   - **반응형 듀얼 레이아웃**: 모바일, 태블릿, 데스크톱 등 화면 해상도에 맞춰 최적화된 화면을 제공합니다.

---

## 📂 프로젝트 구조 (Directory Structure)

```text
holyseeds/
├── .env                  # Coolify 접속 정보, API 토큰, 대상 프로젝트/환경, DATA_DIR 설정
├── catalog_app.py        # FastAPI 백엔드 서버 (동기화, 메타데이터 CRUD, 이미지 업로드, 자원 서빙)
├── coolify_api.py        # Coolify API v1 래퍼 클라이언트 모듈 (Python)
├── database.py           # SQLite DB 초기화, 실시간 비교 갱신(Upsert), 메타데이터 관리 모듈
├── Dockerfile            # DATA_DIR 환경변수 및 VOLUME 선언이 포함된 컨테이너 빌드 명세
├── requirements.txt      # Python 의존성 목록
├── README.md             # 본 설명서 파일
├── data/                 # 통합 Persistent Volume 디렉토리 (.gitignore)
│   ├── catalog.db        # SQLite 데이터베이스 파일
│   └── uploads/          # 사용자 업로드 이미지 저장 디렉토리
├── notes/                # 요구사항 명세서 및 개발 이력서 디렉토리
│   ├── requirement.md    # 기능 및 비기능 요구사항 정의서 (v1.2.0)
│   └── history.md        # 개발 작업 및 변경 이력서 (시간순 기록)
└── static/               # 프론트엔드 정적 웹 리소스
    ├── index.html        # 메인 웹 페이지 및 듀얼 컬럼 상세/편집 모달
    ├── style.css         # 반응형 카드 그리드, 상세 뷰, 배너, 애니메이션 CSS
    └── app.js            # 실시간 Fetch, 검색, 프리뷰, 파일 업로드, 모달 제어 JS
```

---

## 🛠️ 시작하기 (Prerequisites & Installation)

### 1. 요구사항
- **Python 3.10 이상** (테스트 완료: `3.13`)
- 프로젝트 루트 디렉토리에 유효한 **`.env`** 설정 파일

### 2. 가상 환경 구성 및 패키지 설치
```powershell
# 1. 가상환경 생성
python -m venv .venv

# 2. 가상환경 활성화 (Windows PowerShell 기준)
.venv\Scripts\Activate.ps1

# 3. 필요한 의존성 라이브러리 설치
pip install -r requirements.txt
```

### 3. 환경 변수 파일 구성 (`.env`)
프로젝트 루트 디렉토리의 `.env` 파일에 사용 중인 Coolify 연결 정보와 대상 프로젝트/환경, 데이터 디렉토리를 설정합니다:
```env
# Coolify API Configuration
COOLIFY_URL=https://coolify.thewayworks.net

# API Token (Bearer Token) generated from Coolify Dashboard
COOLIFY_TOKEN=your_coolify_api_token_here

# 대상 Coolify 프로젝트 및 환경 (기본값 설정)
COOLIFY_PROJECT=holyseeds
COOLIFY_PRODUCTION=production

# 영구 볼륨 데이터 디렉토리 (SQLite DB 및 업로드 이미지 통합 저장)
DATA_DIR=data
```

---

## 🚀 카탈로그 웹 서비스 구동 방법 (Running the App)

아래 명령어를 통해 FastAPI 및 Uvicorn 웹 서버를 즉시 기동할 수 있습니다:

```powershell
# Uvicorn 개발 서버 실행
uvicorn catalog_app:app --host 0.0.0.0 --port 5000 --reload
```

서버 구동 후 웹 브라우저에서 **`http://localhost:5000`** 주소로 접속하시면 실시간으로 동기화된 웹앱 카탈로그를 확인하고 각 카드의 **`[ ⚙️ 상세 및 편집 ]`** 버튼을 눌러 상세 정보를 열람하고 메타데이터를 직접 편집할 수 있습니다.

---

## 🔌 주요 API 엔드포인트 (API Endpoints)

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/` | 카탈로그 웹 UI 메인 페이지 |
| `GET` | `/api/status` | 서비스 헬스체크 및 현재 타겟 프로젝트/환경 반환 |
| `GET` | `/api/config` | 현재 프로젝트, 환경, 인스턴스 URL 설정 정보 반환 |
| `GET` | `/api/apps` | Coolify 실시간 조회 ➔ SQLite DB 비교 동기화 ➔ 커스텀 메타데이터 병합 목록 반환 |
| `GET` | `/api/apps/{uuid}` | 특정 웹앱의 DB 레코드 및 메타데이터 상세 반환 |
| `POST` | `/api/apps/{uuid}/metadata` | 사용자 지정 TITLE, DESCRIPTION, IMAGE, ICON 갱신 |
| `POST` | `/api/upload` | 로컬 대표 이미지 파일 업로드 (`$DATA_DIR/uploads/` 저장 및 URL 반환) |

---

## 🐳 Docker 컨테이너 구동 방법 (Docker Guide)

Dockerfile 내부에는 `DATA_DIR=/app/data`와 `VOLUME ["/app/data"]`가 기본 선언되어 있어, 단일 볼륨 마운트만으로 DB와 업로드 파일이 안전하게 영구 보존됩니다:

### 1. Docker 이미지 빌드
```bash
docker build -t holyseeds-catalog .
```

### 2. Docker 컨테이너 실행 (Persistent Volume 적용)
호스트의 `data` 디렉토리 또는 Docker Named Volume을 마운트합니다:

```bash
# Named Volume을 사용하는 경우 (권장)
docker run -d \
  --name holyseeds-catalog-service \
  -p 5000:5000 \
  --env-file .env \
  -v holyseeds-catalog-data:/app/data \
  holyseeds-catalog

# 또는 호스트 디렉토리를 직접 마운트하는 경우
docker run -d \
  --name holyseeds-catalog-service \
  -p 5000:5000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  holyseeds-catalog
```

> [!TIP]
> 컨테이너를 중지하고 새 버전의 이미지로 교체(`docker run` 새로 실행)하더라도 마운트된 볼륨(`holyseeds-catalog-data`) 내의 SQLite DB(`catalog.db`)와 업로드 이미지(`uploads/`)는 그대로 유지됩니다.

### 3. 컨테이너 헬스 체크
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/status')"
```

---

## 💡 운영 아키텍처 및 배포 설계 규칙 (Infrastructure Rules)

지정된 도메인(`http://holyseeds.thewayworks.net`)의 하위 경로로 안정적인 멀티 웹 서비스를 유지하기 위한 필수 기술적 규칙 요약입니다.

1. **Cloudflare Tunnel 및 SSL 종단 처리 정합성**
   - Coolify 대시보드 내 FQDN 주소 입력 시 **반드시 `http://`로 설정**해야 합니다. (예: `http://holyseeds.thewayworks.net/reserve`)
   - 만약 FQDN에 `https://`를 직접 명시하면, Coolify의 내부 Traefik 프록시가 자체 SSL 인증을 시도하여 **Cloudflare 엣지 보안 설정과 무한 리다이렉트 루프 충돌**을 야기합니다.
2. **Strip Path Prefix 미들웨어 설정**
   - 웹 애플리케이션이 도메인 루트(예: `/`)를 기준으로 정적 자원을 처리하도록 설계된 경우, Coolify Configuration > Settings > Proxy 탭에서 **`Strip Path Prefix`**를 반드시 **Enabled(활성화)** 해야 404 오류가 방지됩니다.
3. **정적 파일 경로 기재 방식**
   - 하위 경로 라우팅 웹 브라우저가 CSS, JS 파일을 찾을 수 있도록 코드 내부 정적 경로는 절대 경로(`/assets/style.css`) 대신 **상대 경로(`./assets/style.css`)** 형태로 코딩하거나, 빌드 타겟 Base Path 옵션을 해당 분기 경로명(예: `/reserve/`)으로 선언해 빌드해야 스타일이 깨지지 않습니다.
