// official · zh-CN：官方 API Key（components/official-keys.js、设置 → 模型）
export default {
  "custom": {
    "back": "其他连接方式",
    "title": "自定义中转站",
    "summary": "自己填写 URL 和 Key，获取上游模型并指定默认模型",
    "configure": "配置",
    "note": "连接支持 OpenAI Chat Completions 的中转站或本地服务。Key 只保存在本机。",
    "url": "API Base URL",
    "keepKey": "留空沿用已保存的 Key ••••{tail}",
    "discover": "获取上游模型",
    "model": "默认模型",
    "choose": "从上游列表选择模型",
    "manual": "也可以手填准确的模型 ID",
    "modelNote": "上游不支持 /models 时可手填模型 ID。图片、嵌入、重排等模型不能用于对话。",
    "test": "测试所选模型",
    "testNote": "向此上游发送一次简短请求，可能按正常 API 费率计费。",
    "testOk": "模型测试成功，可以正常回复。",
    "found": "已获取 {count} 个模型，请选择对话模型后测试。",
    "save": "保存并使用此模型",
    "remove": "断开自定义中转站"
},
  "useOwn": "使用自己的 API Key",
  "choose": "选择模型服务",
  "placeholder": "粘贴 {name} 的 API Key",
  "keyLabel": "{name} 的 API Key",
  "connect": "连接",
  "connecting": "正在验证…",
  "privacy": "Key 只保存在这台设备上，模型请求直接发给 {name}，不经过 OKINTO New API。",
  "getKey": "获取 Key ↗",
  "backToLogin": "返回登录 OKINTO New API",
  "note": "用你自己在模型厂商申请的 Key，费用由厂商直接收取。Key 只保存在这台设备上，模型请求不经过 OKINTO New API。生图和生视频暂时只能通过 OKINTO New API 使用。",
  "connected": "已连接 ••••{tail} · {count} 个模型",
  "addName": "添加官方 API Key",
  "addSub": "OpenAI、Anthropic、Google Gemini、DeepSeek 等厂商的官方接口",
  "keys": "官方 api key 密钥 直连 openai anthropic gemini grok deepseek kimi glm qwen minimax mistral",
  "replace": "更换 Key",
  "removeButton": "移除",
  "remove": {
    "title": "移除 {name} 的 Key？",
    "body": "这家的模型会从列表里消失。正在用这些模型的机器人需要换一个模型。",
    "bodyLast": "这是最后一个模型来源。移除后要重新登录 OKINTO New API 或填入 API Key 才能继续使用。",
    "confirm": "移除"
  },
  "region": {
    "cn": "中国",
    "global": "海外"
  },
  "named": "{name}（{region}）"
};
