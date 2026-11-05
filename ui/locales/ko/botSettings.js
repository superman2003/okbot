export default {
  "back": "대화로 돌아가기",
  "backTitle": "대화로 돌아가기(Esc)",
  "title": "봇 설정",
  "identity": "프로필",
  "avatar": "아바타",
  "avatarHint": "캐릭터마다 고유한 동작이 있습니다",
  "name": "이름",
  "prompt": "역할 / 시스템 프롬프트",
  "promptHint": "입력란을 벗어나면 저장됩니다",
  "promptPlaceholder": "예: 당신은 유능한 도우미입니다. 간결하고 정확하게 답변하세요.",
  "model": {
    "head": "모델",
    "default": "기본 모델",
    "defaultSub": "대화에서 일시적으로 다른 모델을 선택할 수도 있습니다",
    "followGlobal": "전역 기본값 사용",
    "followGlobalWith": "전역 기본값 사용({model})",
    "utility": "백그라운드 작업 모델",
    "utilitySub": "기억 정리, 컨텍스트 관리, 인계 메모 작성에 사용합니다",
    "sameAsChat": "대화 모델과 동일"
  },
  "budget": {
    "name": "예산",
    "signedOut": "OKINTO New API에 로그인하면 이 봇의 지출 한도를 별도로 설정할 수 있습니다",
    "signIn": "로그인",
    "off": "계정 잔액을 다른 봇과 공유하며 별도 한도가 없습니다",
    "on": "이 봇의 비용을 따로 계산하며 한도에 도달하면 중지합니다",
    "usage": "{used} 사용 · {remain} 남음",
    "exhausted": "{used} 사용 · 잔액이 없어 봇의 모델 호출을 일시 중지했습니다",
    "limit": "한도(USD)",
    "limitSub": "이미 사용한 금액을 포함합니다. 한도를 올리면 자동으로 복구됩니다.",
    "limitLabel": "예산 한도(USD)"
  ,
  "playground": "OKINTO 계정 잔액을 사용합니다. 봇별 한도는 지원하지 않습니다."
},
  "perm": {
    "head": "권한",
    "name": "파일 접근",
    "workspaceSub": "이 봇의 작업 공간만 수정할 수 있으며 그 밖의 작업에는 승인이 필요합니다",
    "readonlySub": "파일을 수정할 수 없으며 명령은 읽기 전용 샌드박스에서 실행됩니다",
    "title": "작업 공간 쓰기(기본값): 이 봇의 작업 공간만 수정할 수 있고 그 밖의 작업에는 승인이 필요합니다. 읽기 전용: 파일을 수정할 수 없으며 명령은 읽기 전용 샌드박스에서 실행됩니다. 전체 접근: 명령을 샌드박스 없이 실행하며 재귀 삭제만 확인이 필요합니다.",
    "workspace": "작업 공간 쓰기",
    "readonly": "읽기 전용",
    "full": "전체 접근"
  },
  "memory": {
    "head": "기억",
    "name": "장기 기억",
    "review": "매 대화 차례가 끝나면 자동으로 정리",
    "reviewLabel": "기억 자동 정리",
    "team": "팀 기억에 쓰기 허용",
    "teamSub": "모든 봇이 공유합니다",
    "teamLabel": "팀 기억"
  },
  "context": {
    "head": "컨텍스트",
    "name": "자동 압축 또는 새 구간 시작",
    "sub": "대화 맥락이 길어지면 정리하고 인계 메모를 남깁니다",
    "label": "컨텍스트 관리자"
  },
  "computer": {
    "head": "컴퓨터 사용",
    "backend": "백엔드",
    "backendLabel": "컴퓨터 사용 백엔드",
    "cuaNote": "앱에 포함되어 있으며 macOS, Windows, Linux를 지원합니다",
    "codex": "Codex 브리지",
    "macOnly": "macOS 전용",
    "macOnlyUnavailable": "macOS 전용 · 이 기기에서는 사용할 수 없습니다",
    "approval": "승인",
    "approvalLabel": "컴퓨터 사용 승인",
    "autoSub": "모든 동작을 자동으로 실행합니다",
    "askSub": "클릭, 입력 등 화면을 변경하는 동작 전에 승인을 요청합니다. 화면 읽기는 자동으로 진행합니다",
    "auto": "자동 실행",
    "ask": "화면 변경 전에 확인"
  },
  "danger": {
    "head": "주의가 필요한 설정",
    "delete": "봇 삭제",
    "deleteSub": "이 봇과 모든 대화를 영구적으로 삭제합니다"
  },
  "access": {
    "head": "사용 가능한 사람",
    "policy": "소유자와 허용한 사람만 사용 가능",
    "owner": "{channel} 소유자",
    "reset": "변경",
    "resetOwnerTitle": "{channel} 소유자를 변경할까요?",
    "resetOwnerBody": "다음에 봇에게 메시지를 보내는 사람이 {channel} 소유자가 됩니다. ‘{who}’ 님은 다시 사용 허가를 받아야 합니다.",
    "allowed": "허용됨",
    "denied": "거부됨",
    "deniedSub": "{when} 거부됨 · 다시 메시지를 보내도 답장하지 않습니다",
    "allow": "허용",
    "remove": "삭제",
    "removeDeniedTitle": "‘{who}’ 님을 삭제할까요?",
    "removeDeniedBody": "이후 다시 메시지를 보내면 정보 패널의 사용 요청에 다시 표시됩니다.",
    "revokeTitle": "‘{who}’ 님의 사용 허가를 취소할까요?",
    "revokeBody": "다시 메시지를 보내면 간단한 안내만 받으며 사용 허가를 다시 받아야 합니다."
  },
  "media": {
    "head": "이미지와 동영상",
    "confirm": "생성 전에 확인",
    "alwaysSub": "생성할 때마다 사용할 모델을 확인합니다",
    "autoSub": "예상 비용이 $0.5를 초과할 때만 확인합니다",
    "auto": "필요할 때 확인",
    "always": "항상 확인"
  },
  "proactive": {
    "head": "먼저 보내는 메시지",
    "pause": "백그라운드 작업 일시 중지",
    "pauseSub": "작업, 규칙, 푸시 메시지는 대기하며 대화는 평소대로 사용할 수 있습니다",
    "quiet": "방해 금지",
    "quietSub": "방해 금지가 끝날 때까지 백그라운드 결과 전송을 기다립니다",
    "quietFrom": "방해 금지 시작",
    "quietTo": "방해 금지 종료",
    "nudge": "WeChat 대화 갱신 알림",
    "nudgeSub": "전송 대기 중인 메시지가 있으면 24시간 제한이 끝나기 전에 답장을 요청합니다",
    "rules": "규칙",
    "rulesSub": "예약 확인 및 알림",
    "rulesCount": {
      "other": "규칙 {count}개 · 정보 패널의 작업 탭에서 확인"
    },
    "newRule": "새로 만들기"
  }
};
