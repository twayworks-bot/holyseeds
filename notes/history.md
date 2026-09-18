# Holyseeds Coolify 웹앱 카탈로그 개발 이력서 (Development History)

본 문서는 Holyseeds Coolify 웹앱 카탈로그의 요구사항 분석 및 구현 과정을 시간순으로 상세히 기록한 작업 로그입니다.

---

## [2026-09-18 23:58] 요구사항 접수 및 초기 현황 분석
- **작업 내용**:
  - 사용자 요구사항 접수:
    1. `.env`의 `COOLIFY_PROJECT`, `COOLIFY_PRODUCTION` 환경변수 연동 및 기본값 설정
    2. Coolify API 조회 웹앱 리스트를 SQLite DB 테이블에 기록 및 실시간 비교 갱신(Upsert & Sync)
    3. 추출한 모든 정보(PROJECT, PRODUCTION, CONTAINER NAME, 원본 JSON 등) 기록
    4. 사용자가 웹앱별 TITLE, DESCRIPTION, IMAGE, ICON을 등록/수정할 수 있는 친화적 기능 추가 및 카탈로그 우선 반영
    5. `notes/requirement.md`, `notes/history.md`, `README.md` 문서화
  - 저장소 구조 및 기존 소스 코드 분석 (`catalog_app.py`, `coolify_api.py`, `.env`, `static/index.html`, `static/app.js`, `static/style.css`, `README.md`)
  - Coolify v1 API 응답 데이터 필드 분석 (`projects`, `applications`, `resources` 엔드포인트 테스트 완료)

## [2026-09-19 00:01] 환경 변수 수정 및 요구사항 명세서 작성
- **작업 내용**:
  - `.env` 파일 내 중복 지정되어 있던 `COOLIFY_PROJECT=production`을 `COOLIFY_PRODUCTION=production`으로 정상 수정.
  - `notes/requirement.md` 생성:
    - 환경 변수 연동 요구사항 (FR-ENV)
    - SQLite DB 저장, 실시간 비교 및 동기화 요구사항 (FR-DB)
    - 메타데이터(TITLE, DESCRIPTION, IMAGE, ICON) 등록/수정 및 UI/UX 표현 요구사항 (FR-META)
    - SQLite 데이터베이스 스키마 설계 (`app_catalog` 테이블)
    - 비기능 요구사항 정의

## [2026-09-19 00:02] SQLite 데이터베이스 모듈(`database.py`) 설계 및 구현
- **작업 내용**:
  - `database.py` 신규 생성:
    - `init_db()`: `catalog.db` 및 `app_catalog` 테이블 생성 (인덱스 포함).
    - `sync_applications_to_db()`:
      - Coolify 실시간 조회 데이터와 DB 기존 레코드 비교 (Upsert).
      - 신규 앱 `INSERT`, 기존 앱 `UPDATE` (상태, FQDN, 포트, Git 정보 등 최신화).
      - Coolify에서 추출한 모든 원본 데이터(`raw_data` JSON) 및 `container_name`, `project`, `production` 완벽 저장.
      - **중요**: 동기화 중 사용자가 등록한 커스텀 메타데이터(`custom_title`, `custom_description`, `custom_image`, `custom_icon`) 영구 보존 보장.
      - 이번 동기화에서 미감지된 애플리케이션 `is_active = 0` 처리.
    - `update_app_metadata()`: 사용자가 지정한 TITLE, DESCRIPTION, IMAGE, ICON 메타데이터 안전 갱신.
    - `get_all_apps_from_db()` / `get_app_by_uuid()`: 앱 목록 및 단건 조회 제공.
  - 단위 테스트 완료: 테이블 스키마 22개 컬럼 초기화 확인.

## [2026-09-19 00:03] 백엔드 API 고도화 및 의존성 업데이트 (`catalog_app.py`, `Dockerfile`, `requirements.txt`)
- **작업 내용**:
  - `requirements.txt`: `python-multipart` 추가 (이미지 파일 업로드 지원).
  - `Dockerfile`: `COPY database.py .` 스텝 추가.
  - `catalog_app.py` 전면 리팩토링:
    - `.env`의 `COOLIFY_PROJECT`, `COOLIFY_PRODUCTION`을 읽어 Coolify API와 통신하여 프로젝트 UUID 및 환경 ID를 동적으로 탐색 (`resolve_ids()`).
    - `/api/apps`: 실시간 Coolify 앱 조회 후 `database.sync_applications_to_db()`를 거쳐 커스텀 메타데이터가 병합된 완성형 카탈로그 리스트 반환.
    - 네트워크 장애 시 SQLite DB 캐시 레코드로 자동 폴백(Fallback) 처리하여 무중단 고가용성 확보.
    - `/api/apps/{uuid}/metadata`: 사용자 메타데이터 갱신 API (Pydantic 유효성 검사 적용).
    - `/api/upload`: 로컬 이미지 파일 업로드 엔드포인트 (`static/uploads/` 저장, 고유 파일명 생성).
    - `/api/config`: 현재 대상 프로젝트, 환경명, Coolify 인스턴스 정보 반환.
    - 윈도우 cp949 콘솔 인코딩 에러 방지(`sys.stdout.reconfigure` 및 로그 태그 표준화).

## [2026-09-19 00:08] 사용자 친화적 웹 UI/UX 고도화 (`index.html`, `style.css`, `app.js`)
- **작업 내용**:
  - `static/index.html`:
    - 헤더에 현재 타겟 프로젝트 및 환경명 배지(`env-badge`) 추가.
    - 웹앱 메타데이터 설정 모달 다이얼로그(`metadata-modal`) 추가.
    - 모달 내 TITLE, DESCRIPTION, ICON, IMAGE 입력 폼 및 프리셋 아이콘 팔레트, 파일 업로드 버튼 구성.
    - 모달 내 실시간 카드 미리보기(`modal-preview-card`) 및 토스트 알림 컨테이너 추가.
  - `static/style.css`:
    - 카드 상단 대표 이미지 배너(`.card-banner-wrapper`, `.card-banner-img`) 스타일링.
    - 커스텀 아이콘, 타이틀 및 원본 이름 배지(`.app-original-badge`) 스타일링.
    - 커스텀 설명 박스(`.app-description-box`) 및 컨테이너명 배지(`.container-pill`) 디자인.
    - 카드 우측 상단 메타데이터 편집 버튼(`.btn-edit-metadata`) 추가.
    - 블러 배경의 모달 다이얼로그 및 반응형 폼, 아이콘 픽커, 이미지 업로더 스타일링.
    - 부드러운 애니메이션 토스트 알림(`.toast`) 스타일 추가.
  - `static/app.js`:
    - `/api/config`를 통한 헤더 배지 동적 업데이트.
    - 메타데이터(TITLE, DESCRIPTION, ICON, IMAGE) 우선 반영 렌더링 로직 구현.
    - 검색 기능 확장: 명칭, 설명, 컨테이너명, 경로, 브랜치, Git 저장소 통합 실시간 검색.
    - 모달 열기/닫기, 프리셋 아이콘 선택, 실시간 입력 반영 카드 라이브 프리뷰 구현.
    - 비동기 이미지 파일 업로드 및 API 메타데이터 저장 핸들러 구현.

## [2026-09-19 00:10] 전체 시스템 통합 테스트 및 정합성 검증
- **작업 내용**:
  - FastAPI TestClient를 통한 전체 API 엔드포인트 통합 테스트:
    1. `GET /`: HTML 정적 자원 정상 서빙 확인 (Status: 200).
    2. `GET /api/config`: 프로젝트(`holyseeds`), 환경(`production`) 정상 응답.
    3. `GET /api/apps`: 8개 웹 애플리케이션 실시간 조회 및 SQLite 동기화 확인.
    4. `POST /api/apps/{uuid}/metadata`: 메타데이터 갱신 테스트 성공.
    5. 실시간 재조회(`GET /api/apps`) 시 사용자가 수정한 메타데이터가 영구 보존됨을 완벽 검증.
    6. `POST /api/upload`: 이미지 업로드 및 URL 반환 기능 테스트 성공.

## [2026-09-19 00:30] Persistent Volume 환경변수 추가 및 상세 & 편집 화면 고도화
- **작업 내용**:
  - **통합 Persistent Volume (`DATA_DIR`) 구성**:
    - `Dockerfile`: `ENV DATA_DIR=/app/data`, `RUN mkdir -p /app/data/uploads`, `VOLUME ["/app/data"]` 추가.
    - `database.py`: `DATA_DIR` 환경변수를 기반으로 `DB_PATH = $DATA_DIR/catalog.db` 설정 및 기존 DB 마이그레이션 로직 추가.
    - `catalog_app.py`: `UPLOAD_DIR = $DATA_DIR/uploads`로 통합하여 업로드된 이미지 파일과 DB가 동일한 볼륨에서 관리되도록 구성.
    - `.env`: `DATA_DIR=data` 설정 추가.
    - `.gitignore`: `data/` 디렉토리 및 `catalog.db` 등록으로 로컬 지속성 파일 보안 분리.
  - **카탈로그 카드 편집 버튼 시각성 강화**:
    - 각 카드 상단 우측에 텍스트가 포함된 눈에 띄는 **`[ ✏️ 편집 ]` 배지 버튼** 추가.
    - 각 카드 하단 액션 영역을 듀얼 버튼 구조로 개선:
      1. **`[ ⚙️ 상세 및 편집 ]` 버튼** (메인 관리 버튼)
      2. **`[ 🚀 바로가기 ]` 버튼** (서비스 다이렉트 링크)
    - 카드 배너, 아바타, 타이틀 클릭 시에도 상세 및 편집 화면으로 바로 진입 가능하도록 UX 연결.
  - **웹앱 상세보기 & 메타데이터 편집 듀얼 컬럼 뷰 구축**:
    - 모달을 대형(1100px) 2-컬럼 반응형 레이아웃(`modal-body-split`)으로 전면 확장:
      - **좌측 섹션**: 실시간 서비스 가동 상태, FQDN 링크, Prefix, Docker 컨테이너명, 프로젝트/환경, Git 저장소/브랜치, 빌드팩, 노출 포트, Coolify 갱신 일시, DB 동기화 일시 등 종합 운영 정보 제공 + 카탈로그 카드 실시간 미리보기.
      - **우측 섹션**: TITLE, DESCRIPTION, ICON(추천 프리셋 12종 + 클래스 직접 입력), IMAGE(내 PC에서 파일 업로드 + 웹 URL 입력 + 미리보기/삭제) 편집 폼.
    - 기본값 복원 버튼 및 실시간 저장 핸들러 구현.
  - **통합 볼륨 및 업로드 기능 검증**:
    - 파일 업로드 시 `data/uploads/`에 정확히 저장되고, `/uploads/...`로 정상 200 반환 및 영속성 보장 확인 완료.
