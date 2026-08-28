# Holyseeds Coolify 웹앱 카탈로그 (Catalog Web UI)

본 저장소는 **Coolify API v1**을 연동하여 `holyseeds` 프로젝트(`production` 환경)의 공용 도메인(`http://holyseeds.thewayworks.net`) 하위에서 구동 중인 다양한 웹 애플리케이션들을 탐색하고, 하위 경로(Prefix) 분기별로 한눈에 파악할 수 있도록 돕는 **반응형 웹 카탈로그 시스템**입니다.

---

## 🌟 핵심 기능 (Key Features)

1. **실시간 Coolify 연동 및 자동 파싱**
   - 로컬 `.env` 파일을 로드하여 Coolify API 서버와 안전하게 통신합니다.
   - `holyseeds` 프로젝트의 `production` 환경에 소속된 애플리케이션만을 필터링합니다.
   - FQDN 주소에서 `/reserve`, `/planning`과 같은 **하위 라우팅 경로(Prefix)**를 파싱하여 UI에 매칭합니다.

2. **모던한 디자인 및 뛰어난 비주얼 (Vanilla CSS & JS)**
   - **그라데이션 로고 생성**: 애플리케이션 고유 명칭을 기반으로 미려한 그라데이션 원형 아바타 로고를 자동 생성합니다.
   - **가동 상태 실시간 트래킹**: 컨테이너 가동 여부에 따라 생동감 있는 **Pulsing Green Dot** 애니메이션이 표시됩니다.
   - **반응형 그리드 레이아웃**: 데스크톱, 태블릿, 모바일 등 모든 디바이스에 맞춰 최적화된 화면 구성을 보여줍니다.

3. **고급 인터랙션**
   - **인스턴트 검색**: 검색창 입력 즉시 이름, 경로, Git 레포지토리, 브랜치명을 기준으로 결과를 실시간 필터링합니다.
   - **깃허브 다이렉트 링크**: 배포에 쓰인 GitHub 레포지토리 경로로 손쉽게 이동할 수 있는 단축 링크를 동적 제공합니다.
   - **새로고침 버튼**: 필요할 때마다 백엔드를 거쳐 Coolify의 최신 구동 상태를 원터치로 갱신합니다.

---

## 📂 프로젝트 구조 (Directory Structure)

```text
C:\dev\python\holyseeds\
├── .env                  # Coolify API 주소 및 Bearer 토큰 정보가 들어있는 환경변수 파일
├── catalog_app.py        # FastAPI 웹 서버 (애플리케이션 필터링 API 제공 및 웹 자원 서빙)
├── coolify_api.py        # Coolify API v1 래퍼 클라이언트 모듈 (Python)
├── README.md             # 본 설명서 파일
└── static/               # 프론트엔드 정적 웹 리소스 디렉토리
    ├── index.html        # 메인 웹 페이지 (Inter & Noto Sans KR 웹폰트 및 FontAwesome 탑재)
    ├── style.css         # 카드 레이아웃, 상태 배지, 리얼타임 펄스 애니메이션 (Vanilla CSS)
    └── app.js            # API 비동기 Fetch, 통계 자동 집계, 검색 및 필터 인터랙션 (Vanilla JS)
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
pip install fastapi uvicorn requests python-dotenv
```

### 3. 환경 변수 파일 구성 (`.env`)
프로젝트 루트 디렉토리의 `.env` 파일에 사용 중인 Coolify 연결 정보와 API 토큰을 설정합니다:
```env
# Coolify API Configuration
COOLIFY_URL=https://coolify.thewayworks.net

# API Token (Bearer Token) generated from Coolify Dashboard
COOLIFY_TOKEN=your_coolify_api_token_here
```

---

## 🚀 카탈로그 웹 서비스 구동 방법 (Running the App)

아래 명령어를 통해 FastAPI 및 Uvicorn 웹 서버를 즉시 기동할 수 있습니다.

```powershell
# Uvicorn 개발 서버 실행
uvicorn catalog_app:app --host 0.0.0.0 --port 5000
```

서버 구동 후 웹 브라우저에서 **`http://localhost:5000`** 주소로 접속하시면 가동 중인 전체 서비스 리스트를 아름다운 카탈로그 화면으로 확인하실 수 있습니다.

---

## 🐳 Docker 컨테이너 구동 방법 (Docker Guide)

본 웹앱은 컨테이너화되어 즉시 독립적으로 배포 및 운영할 수 있습니다. 

### 1. Docker 이미지 빌드
```bash
docker build -t holyseeds-catalog .
```

### 2. Docker 컨테이너 실행
실행 시 로컬 `.env` 파일을 컨테이너 내부로 마운트하거나 환경변수로 주입해줍니다.
```bash
docker run -d \
  --name holyseeds-catalog-service \
  -p 5000:5000 \
  --env-file .env \
  holyseeds-catalog
```

### 3. 컨테이너 헬스 체크 작동 방식
Dockerfile 내부에는 다음과 같은 최적의 자가 진단 헬스 체크가 기재되어 컨테이너 상태를 실시간 보증합니다:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD python -c "import requests; requests.get('http://localhost:5000/planning/api/status')"
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
