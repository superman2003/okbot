// official · ko：官方 API Key（components/official-keys.js、设置 → 模型）
export default {
  "custom": {
    "back": "다른 연결 방법",
    "title": "사용자 지정 중계 서버",
    "summary": "API URL과 키를 입력하고 업스트림 모델을 가져와 기본 모델 선택",
    "configure": "설정",
    "note": "OpenAI 또는 Anthropic 호환 중계, 공식 API, 로컬 서비스에 연결합니다. 키는 기기에만 저장합니다.",
    "url": "API 기본 URL",
    "keepKey": "비워 두면 저장된 키 사용 ••••{tail}",
    "discover": "업스트림 모델 가져오기",
    "model": "기본 모델",
    "choose": "업스트림 모델 선택",
    "manual": "정확한 모델 ID를 직접 입력할 수도 있습니다",
    "modelNote": "/models를 지원하지 않으면 ID를 직접 입력하세요. 이미지, 임베딩, 재순위 모델은 대화에 사용할 수 없습니다.",
    "test": "선택한 모델 테스트",
    "testNote": "업스트림에 짧은 요청을 한 번 전송합니다. 일반 API 요금이 부과될 수 있습니다.",
    "testOk": "선택한 모델이 정상 응답했습니다.",
    "found": "모델 {count}개를 가져왔습니다. 대화 모델을 선택하고 테스트하세요.",
    "save": "저장하고 이 모델 사용",
    "remove": "사용자 지정 서버 연결 해제",
    "protocol": "API 프로토콜",
    "openaiNote": "Bearer 키로 Chat Completions(/chat/completions)를 사용합니다.",
    "anthropicNote": "Anthropic Messages(/v1/messages)에 x-api-key 또는 Bearer 인증을 선택합니다. 루트, /v1, 전체 Messages URL 및 모델 ID 직접 입력을 지원합니다.",
    "authMode": "Anthropic 인증 방식"
},
  "useOwn": "내 API 키 사용",
  "choose": "서비스 선택",
  "placeholder": "{name} API 키 붙여넣기",
  "keyLabel": "{name} API 키",
  "connect": "연결",
  "connecting": "확인 중…",
  "privacy": "키는 이 기기에만 저장됩니다. 모델 요청은 OKINTO New API를 거치지 않고 {name}(으)로 바로 전송됩니다.",
  "getKey": "키 발급 ↗",
  "backToLogin": "OKINTO New API 로그인으로 돌아가기",
  "note": "모델 제공업체에서 직접 발급받은 키를 사용하며 요금은 제공업체가 직접 청구합니다. 키는 이 기기에만 저장되고 모델 요청은 OKINTO New API를 거치지 않습니다. 이미지·동영상 생성은 현재 OKINTO New API로만 사용할 수 있습니다.",
  "connected": "연결됨 ••••{tail} · 모델 {count}개",
  "addName": "공식 API 키 추가",
  "addSub": "OpenAI, Anthropic, Google Gemini, DeepSeek 등의 공식 API",
  "keys": "공식 api 키 직접 openai anthropic gemini grok deepseek kimi glm qwen minimax mistral",
  "replace": "키 변경",
  "removeButton": "삭제",
  "remove": {
    "title": "{name} 키를 삭제할까요?",
    "body": "이 제공업체의 모델이 목록에서 사라집니다. 해당 모델을 쓰는 봇은 다른 모델로 바꿔야 합니다.",
    "bodyLast": "마지막 모델 제공처입니다. 삭제하면 OKINTO New API에 로그인하거나 API 키를 입력해야 계속 사용할 수 있습니다.",
    "confirm": "삭제"
  },
  "region": {
    "cn": "중국",
    "global": "글로벌"
  },
  "named": "{name} ({region})"
};
