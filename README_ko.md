# okbot

직접 입력한 API URL과 키로 원하는 모델 서비스에 연결하는 개인 AI 어시스턴트입니다.

[简体中文](./README.md) · [English](./README_en.md) · [日本語](./README_ja.md) · [한국어](./README_ko.md) · [Русский](./README_ru.md)

[Windows 다운로드](https://github.com/superman2003/okbot/releases/tag/custom-0.1.27-1) · [문제 보고](https://github.com/superman2003/okbot/issues) · [MIT](./LICENSE)

## 📥 다운로드

현재 릴리스는 **Windows x64 설치 파일** [okbot-0.1.27-win-x64.exe](https://github.com/superman2003/okbot/releases/download/custom-0.1.27-1/okbot-0.1.27-win-x64.exe)(약 160 MB)을 제공합니다. [릴리스 페이지](https://github.com/superman2003/okbot/releases/tag/custom-0.1.27-1)에 `SHA256SUMS`도 있습니다.

Electron, magpie, DeepSeek Harness, Cua Driver를 포함합니다. Node.js나 Go를 따로 설치할 필요가 없습니다. 이 빌드는 서명되지 않았습니다. 창을 닫으면 트레이로 이동하며 트레이 메뉴에서 종료할 수 있습니다. 다른 OS는 소스 빌드를 참고하세요.

## 모델 서비스 설정

1. 첫 실행 화면 또는 설정의 모델 연결에서 사용자 지정 업스트림을 엽니다.
2. **API Base URL**과 **API Key**를 입력합니다. 예: `https://your-api.example/v1`.
3. 모델 목록을 가져와 선택합니다. 목록을 제공하지 않으면 정확한 모델 ID를 입력할 수 있습니다.
4. 선택한 모델을 테스트합니다. 짧은 요청이 전송되며 일반 API 요금이 발생할 수 있습니다.
5. 저장하고 사용합니다. 연결과 기본 모델은 기기에 저장되고 재시작 후에도 유지됩니다.

**OpenAI Chat Completions 호환 API**를 지원합니다. `/chat/completions`는 필수이고 `/models`는 선택 사항입니다. 다른 프로토콜만 제공하는 서비스는 이 입력란에서 직접 사용할 수 없습니다. 루트 URL에는 `/v1`을 추가하고 사용자 지정 경로는 유지합니다.

요청은 설정한 서비스로 전송되며 기능, 한도, 요금은 해당 서비스와 모델에 따라 다릅니다. 기존 공식 API 및 OKINTO 연결도 유지합니다. 개별 모델 설정이 있는 봇과 대화는 따로 전환하세요.

## 기능과 변경 사항

- API URL과 키 설정, 모델 조회, 선택, ID 입력 및 테스트.
- 공급원별 라우팅과 업스트림 모델 ID 및 네임스페이스 유지.
- 연결과 기본 모델의 로컬 저장, 저장된 키는 끝자리만 표시.
- 원 프로젝트의 봇, 페르소나, 작업 공간, 기억, 도구 및 백그라운드 기능 계승.
- 앱 내 채팅, WeChat, Feishu 등의 채널 구현 유지.
- Windows EXE, 로컬 실행 스크립트 및 패키지 런타임 검증.

도구 호출, 컴퓨터 조작, 멀티모달 기능은 모델과 연결 방식에 따라 다릅니다.

## 소스에서 실행

**Node.js 22.13+**, **Go 1.26.8+**가 필요합니다. Setup은 게이트웨이와 런타임을 준비합니다.

```bash
git clone https://github.com/superman2003/okbot.git
cd okbot
npm ci
npm run setup
npm run build
npm start
```

기본 콘솔 주소는 `http://127.0.0.1:3600/`입니다. 설치와 컴파일 후 Windows에서 `Start-Okbot.cmd`를 사용할 수도 있습니다. 기본 포트는 3610이며 인증된 페이지를 엽니다.

소스 실행 데이터는 `data/`, Windows 데스크톱 데이터는 `%APPDATA%\anymodel bot\data`에 있습니다. 키, 대화, 의존성 및 빌드 결과는 저장소에서 제외합니다.

## Windows 설치 파일 빌드

Windows x64에서 실행합니다.

```bash
npm run dist -- --win nsis --x64
```

결과는 `release/`에 저장됩니다. 데스크톱 개발에는 `npm run electron:dev`를 사용합니다. 고정 버전 구성 요소를 다운로드하며 Cua Driver의 SHA256을 확인합니다.

## 문서와 기여

- [개발 문서](./docs/development_ko.md)
- [기여 가이드](./CONTRIBUTING_ko.md)
- [보안 문제 보고](./SECURITY_ko.md)
- [봇 목록](./bots)
- [버그 및 기능 제안](https://github.com/superman2003/okbot/issues)

## 출처와 라이선스

[superman2003](https://github.com/superman2003)이 유지보수하며 [wmn1525/AnyModelBot](https://github.com/wmn1525/AnyModelBot)을 기반으로 개발했습니다. 원래 프로젝트는 [modelflare-ai/AnyModelBot](https://github.com/modelflare-ai/AnyModelBot)입니다. 원 코드와 기여 기록을 유지합니다.

[MIT 라이선스](./LICENSE)를 계승합니다. 재배포 시 원 저작권과 허가 고지를 유지하세요. 포함된 구성 요소의 라이선스는 [타사 고지](./THIRD_PARTY_NOTICES_ko.md)와 [LICENSES](./LICENSES)를 확인하세요. 원저자와 의존성 프로젝트에 감사드립니다.
