# Holyseeds Coolify 웹앱 카탈로그 요구사항 정의서 (Requirement Specification)

- **작성일자**: 2026-09-19
- **버전**: v1.2.0
- **문서 목적**: Coolify 배포 웹 애플리케이션의 카탈로그화, SQLite 데이터베이스를 통한 동기화 및 갱신, 통합 Persistent Volume(`DATA_DIR`) 지원, 사용자 정의 메타데이터(TITLE, DESCRIPTION, IMAGE, ICON) 및 상세/편집 듀얼 뷰 기능에 대한 요구사항 정의

---

## 1. 배경 및 개요 (Background & Overview)

기존 시스템은 `.env`의 `COOLIFY_URL`과 `COOLIFY_TOKEN`을 통해 Coolify v1 API를 호출하여 배포된 웹 애플리케이션을 카탈로그 카드로 제공하였습니다.
최근 요구에 따라 다음과 같은 고도화가 수행되었습니다:
1. 대상 프로젝트와 환경명을 `.env`의 `COOLIFY_PROJECT`와 `COOLIFY_PRODUCTION`을 통해 동적으로 탐색.
2. 실시간 조회한 웹앱 정보(PROJECT, PRODUCTION, CONTAINER NAME, Git 정보, 도메인, 포트, 빌드팩, 원본 JSON 등 모든 정보)를 로컬 SQLite DB 테이블에 기록하고 실시간 비교 갱신(Upsert).
3. **통합 영속성 볼륨 (Persistent Volume)**: 컨테이너 재시작 및 재생성 시에도 SQLite DB(`catalog.db`)와 업로드된 사용자 이미지(`uploads/`)가 유실되지 않도록 동일한 지속성 볼륨 경로(`DATA_DIR`)를 환경변수로 지원하고 Dockerfile에 `VOLUME ["/app/data"]` 구성.
4. **시각적 편집 편의성 및 상세보기 화면 고도화**: 카탈로그 카드에 눈에 띄는 편집 및 상세보기 버튼(`btn-card-edit`, `btn-detail-edit`)을 배치하고, 클릭 시 웹앱 배포/운영 상세 정보와 메타데이터 편집(TITLE/DESCRIPTION/IMAGE/ICON)을 한 화면에서 제공하는 듀얼 컬럼 상세 뷰 제공.
5. Coolify API 재동기화 시에도 사용자가 등록한 커스텀 메타데이터는 영구 보존.

---

## 2. 상세 기능 요구사항 (Detailed Functional Requirements)

### 2.1 환경 변수 연동 요구사항 (FR-ENV)
- **FR-ENV-01**: `.env` 파일에 정의된 `COOLIFY_PROJECT` 환경변수를 로드하여 대상 Coolify 프로젝트를 필터링한다. (기본값: `holyseeds`)
- **FR-ENV-02**: `.env` 파일에 정의된 `COOLIFY_PRODUCTION` 환경변수를 로드하여 대상 환경을 필터링한다. (기본값: `production`)
- **FR-ENV-03**: Coolify API의 프로젝트 목록(`GET /api/v1/projects`) 및 환경 목록(`GET /api/v1/projects/{uuid}`)을 동적으로 조회하여 해당 프로젝트명과 환경명에 일치하는 UUID 및 Environment ID를 찾아낸다.
- **FR-ENV-04 (통합 영속성 볼륨 환경변수)**:
  - 환경변수 `DATA_DIR`를 지원한다. (로컬 기본값: `data`, 컨테이너 기본값: `/app/data`)
  - SQLite 데이터베이스 저장 경로: `$DATA_DIR/catalog.db`
  - 업로드 이미지 저장 경로: `$DATA_DIR/uploads`
  - 단일 볼륨 마운트(`-v my_volume:/app/data`)로 DB와 업로드 파일이 함께 영구 보존되어야 한다.

### 2.2 SQLite 데이터베이스 저장 및 동기화 요구사항 (FR-DB)
- **FR-DB-01**: 내장 SQLite3를 활용하여 로컬 DB 파일(`catalog.db`)을 운용하고 필요한 테이블을 자동 생성한다.
- **FR-DB-02 (전체 정보 수집 및 기록)**: 카탈로그 조회가 일어날 때 Coolify에서 추출한 모든 정보를 테이블에 기록한다:
  - `uuid` (기본키, Unique)
  - `project` (프로젝트 명칭)
  - `production` (환경 명칭)
  - `container_name` (컨테이너 식별 명칭)
  - `name` (Coolify 앱 명칭)
  - `fqdn` (서비스 도메인 URL)
  - `prefix` (하위 라우팅 서브패스)
  - `status` (컨테이너 상태)
  - `git_repository` (GitHub 저장소)
  - `git_branch` (브랜치명)
  - `build_pack` (빌드팩 종류)
  - `exposed_port` (노출 포트)
  - `coolify_created_at` (Coolify 생성 일시)
  - `coolify_updated_at` (Coolify 수정 일시)
  - `raw_data` (Coolify API 원본 응답 JSON 전문)
- **FR-DB-03 (실시간 비교 및 갱신 - Upsert & Sync)**:
  - 실시간으로 읽어온 Coolify 앱 목록과 DB의 기존 레코드를 비교한다.
  - 신규 앱은 DB에 신규 `INSERT`한다.
  - 기존 앱은 변경된 속성(상태, FQDN, 포트, Git 정보 등)을 비교하여 `UPDATE`한다.
  - **중요**: DB 갱신 시 사용자가 기등록한 커스텀 메타데이터는 절대 유실되지 않고 유지되어야 한다.
  - 현재 시점에 Coolify에서 비활성화되거나 삭제된 앱은 `is_active` 플래그를 통해 관리한다.

### 2.3 사용자 친화적 메타데이터 관리 및 상세보기 요구사항 (FR-META & UI)
- **FR-META-01 (등록 대상 항목)**:
  1. `TITLE`: 서비스의 사용자 친화적 명칭 (미지정 시 기존 Coolify 앱 이름 사용)
  2. `DESCRIPTION`: 서비스에 대한 상세 설명 문구
  3. `IMAGE`: 서비스 대표 이미지 URL 또는 로컬 업로드 이미지 경로 (`$DATA_DIR/uploads/`)
  4. `ICON`: 서비스 대표 아이콘 (FontAwesome 클래스명 또는 이모지)
- **FR-META-02 (API 엔드포인트)**:
  - `POST /api/apps/{uuid}/metadata`: 특정 웹앱의 메타데이터를 저장/수정하는 API 제공
  - `POST /api/upload`: 사용자가 로컬 이미지를 간편하게 업로드할 수 있는 파일 업로드 엔드포인트 제공 (`$DATA_DIR/uploads/` 저장 및 `/uploads/...` 라우팅)
- **FR-META-03 (카드 UI/UX 및 접근성)**:
  - 각 카탈로그 카드 상단 우측에 눈에 띄는 **`[ ✏️ 편집 ]`** 버튼 배치.
  - 각 카드 하단 액션 영역에 **`[ ⚙️ 상세 및 편집 ]`** 버튼과 **`[ 🚀 바로가기 ]`** 버튼을 듀얼 버튼으로 명확히 배치.
  - 카드 배너, 아바타, 타이틀 클릭 시에도 상세보기/편집 모달이 즉시 열리도록 구성.
- **FR-META-04 (상세보기 및 편집 화면)**:
  - 모달 다이얼로그를 대형 2-컬럼 구조로 확장:
    - **좌측 섹션**: 실시간 가동 상태, FQDN 링크, Prefix, 도커 컨테이너명, 프로젝트/환경, Git 저장소/브랜치, 빌드팩, 포트, 최종 갱신 일시 등 시스템 상세 정보 표시 + 실시간 카드 라이브 미리보기.
    - **우측 섹션**: TITLE, DESCRIPTION, ICON(추천 프리셋 팔레트 + 직접 입력), IMAGE(파일 업로드 + URL 입력 + 미리보기/삭제) 편집 폼.
    - **하단 섹션**: 기본값 복원 버튼, 저장 버튼.

### 2.4 관리자 권한 및 로그인 검증 요구사항 (FR-AUTH)
- **FR-AUTH-01 (중앙 Keycloak 인증 프록시 연동)**:
  - 인증 검증 Base URL: `https://holyseeds.thewayworks.net/auth` (`AUTH_URL` 환경변수 지원).
  - 세션 검증 API: `GET {AUTH_URL}/api/verify-session?require_role=super` (`auth_spec.md` 규격 준수).
- **FR-AUTH-02 (권한 등급 식별 - Manager Flag = 2)**:
  - `auth_spec.md`의 [패턴 0: 최고 관리자 권한 인증 (Super Admin / flag = "2")] 스펙 적용.
  - `role_flag == "2"` 또는 `is_super == true`를 통해 최고 관리자 여부를 판별한다.
- **FR-AUTH-03 (카드 내 "상세 및 편집" 기능 노출 제어)**:
  - APP 카드 내 "상세 및 편집" 기능/버튼은 항상 로그인 검증을 통해 manager flag=2인지 확인한다.
  - **로그인을 통해 manager flag=2인 경우에만** "상세 및 편집" 버튼 및 모달 진입 기능을 노출한다.
  - **그 외의 경우**(비로그인, 세션 만료, 일반 사용자 flag=0, 일반 관리자 flag=1 등)는 "상세 및 편집" 버튼을 일체 노출하지 않으며 "바로가기" 단일 액션 버튼으로 자동 확장 전환한다.
  - 비인가 상태에서 모달 직접 호출 시도시 토스트 알림을 통해 차단한다.
- **FR-AUTH-04 (백엔드 API 보안 강제)**:
  - `POST /api/apps/{uuid}/metadata` 및 `POST /api/upload` 엔드포인트는 요청 시 전달된 `auth_session` 쿠키를 기반으로 Keycloak Auth 검증을 수행하고, manager flag=2가 아닌 경우 `403 Forbidden` 에러로 처리한다.
- **FR-AUTH-05 (헤더 인증 상태 표시 및 로그인 게이트웨이 유도)**:
  - 카탈로그 헤더 우측에 인증 상태(최고관리자 flag=2 배지, 일반회원 배지, 또는 관리자 로그인 링크)를 제공하여 편리한 세션 제어를 지원한다.

---

## 3. 데이터베이스 스키마 정의 (Database Schema)

```sql
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
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);
```

---

## 4. Docker Persistent Volume 사양

- **환경변수**: `DATA_DIR=/app/data`
- **선언 볼륨**: `VOLUME ["/app/data"]`
- **내부 구조**:
  - `/app/data/catalog.db` (SQLite 메인 데이터베이스)
  - `/app/data/uploads/` (사용자 업로드 이미지 파일)
- **호스트 볼륨 마운트 예시**:
  - `-v holyseeds-data:/app/data` (Named Volume)
  - `-v $(pwd)/data:/app/data` (Bind Mount)
