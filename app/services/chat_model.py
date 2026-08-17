"""The coach's chat model, chosen by config.LLM_PROVIDER.

Because everything runs through LangChain, swapping the "brain" between ChatGPT
and Claude is just picking a different wrapper here — no other code changes.
Kept in its own module so both the agent and the profile condenser share one
factory without importing each other.
"""
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core import config


def build_chat_model() -> BaseChatModel:
    """Build the configured chat model (needs the matching API key)."""
    if config.LLM_PROVIDER == "openai":
        return ChatOpenAI(
            model=config.OPENAI_CHAT_MODEL,
            api_key=config.OPENAI_API_KEY,
            max_tokens=config.MAX_TOKENS,
            timeout=20.0,
            # The current models reason by default, and chat completions
            # refuses to take function tools alongside that — which is every
            # call the coach makes, since recall is a tool. Turning reasoning
            # off is also what we want on its own terms: this is a warm reply
            # grounded in facts already fetched, not a problem to think
            # through, and thinking time would only add latency to a reply
            # the person is watching stream in.
            reasoning_effort="none",
        )
    if config.LLM_PROVIDER == "anthropic":
        return ChatAnthropic(
            model_name=config.ANTHROPIC_CHAT_MODEL,
            api_key=config.ANTHROPIC_API_KEY,
            max_tokens=config.MAX_TOKENS,
            timeout=20.0,
        )
    raise ValueError(f"LLM_PROVIDER must be openai or anthropic, got {config.LLM_PROVIDER!r}")
