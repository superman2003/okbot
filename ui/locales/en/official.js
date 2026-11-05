// official · en：官方 API Key（components/official-keys.js、设置 → 模型）
export default {
  "custom": {
    "back": "Other connection options",
    "title": "Custom upstream",
    "summary": "Set your own API URL and Key, fetch models and choose a default",
    "configure": "Configure",
    "note": "Connect any OpenAI-compatible Chat Completions service. Credentials stay on this device.",
    "url": "API Base URL",
    "keepKey": "Leave blank to keep saved key ••••{tail}",
    "discover": "Fetch upstream models",
    "model": "Default model",
    "choose": "Choose an upstream model",
    "manual": "Or enter an exact model ID",
    "modelNote": "If /models is unavailable, enter the model ID manually. Image, embedding and reranking models cannot be used for chat.",
    "test": "Test selected model",
    "testNote": "Sends one short request to this upstream; normal API charges may apply.",
    "testOk": "The selected model replied successfully.",
    "found": "Fetched {count} models. Choose a chat model, then test it.",
    "save": "Save and use this model",
    "remove": "Disconnect custom upstream"
},
  "useOwn": "Use your own API key",
  "choose": "Choose a provider",
  "placeholder": "Paste your {name} API key",
  "keyLabel": "{name} API key",
  "connect": "Connect",
  "connecting": "Checking…",
  "privacy": "The key stays on this device. Model requests go straight to {name}, not through OKINTO New API.",
  "getKey": "Get a key ↗",
  "backToLogin": "Back to OKINTO New API sign-in",
  "note": "Use keys you got from the model providers, billed by them directly. Keys stay on this device, and model requests don't go through OKINTO New API. Image and video generation is only available through OKINTO New API for now.",
  "connected": "Connected ••••{tail} · {count} models",
  "addName": "Add an official API key",
  "addSub": "Official APIs from OpenAI, Anthropic, Google Gemini, DeepSeek and others",
  "keys": "official api key direct byok openai anthropic gemini grok deepseek kimi glm qwen minimax mistral",
  "replace": "Replace key",
  "removeButton": "Remove",
  "remove": {
    "title": "Remove the {name} key?",
    "body": "This provider's models will leave the list. Bots using them will need another model.",
    "bodyLast": "This is your last model source. You'll need to sign in to OKINTO New API or add an API key to keep using the app.",
    "confirm": "Remove"
  },
  "region": {
    "cn": "China",
    "global": "Global"
  },
  "named": "{name} ({region})"
};
