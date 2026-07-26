"""
AI 康养旅居助手 — LLM Provider
Task 5.2: 统一封装大模型调用
第一版：DeepSeek（OpenAI 兼容 API 格式）
后续切换模型只需修改 config.py 中的三个环境变量。
"""
import requests
from ..config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_NAME


def chat_completion(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> dict:
    """
    调用 LLM 完成一次对话。

    Args:
        system_prompt: 系统提示词（角色 + 规则）
        user_message:  用户消息（具体问题）
        temperature:   生成温度
        max_tokens:    最大输出 token 数

    Returns:
        {"content": "回答文本", "usage": {"prompt_tokens": 123, ...}}

    Raises:
        RuntimeError: API 调用失败时抛出，包含状态码和错误信息
    """
    url = f"{LLM_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": LLM_MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    data = resp.json()

    if resp.status_code != 200:
        error_msg = data.get("error", {}).get("message", resp.text)
        raise RuntimeError(f"LLM 调用失败（{resp.status_code}）: {error_msg}")

    return {
        "content": data["choices"][0]["message"]["content"],
        "usage": data.get("usage", {}),
    }
