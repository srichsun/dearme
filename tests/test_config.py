"""Startup configuration checks.

The point of these is fail-fast: a deploy missing a key should die on boot (so
Cloud Run rolls it back) instead of serving 500s to real people.
"""
import pytest

from app.core import config


def _set(monkeypatch, **values):
    for name, value in values.items():
        monkeypatch.setattr(config, name, value)


def test_a_fully_configured_app_has_nothing_missing(monkeypatch):
    _set(monkeypatch, LLM_PROVIDER="openai", OPENAI_API_KEY="k")
    assert config.missing_required_settings() == []


def test_the_chat_key_for_the_chosen_provider_is_required(monkeypatch):
    _set(monkeypatch, LLM_PROVIDER="anthropic", ANTHROPIC_API_KEY="", OPENAI_API_KEY="k")
    assert any("ANTHROPIC_API_KEY" in m for m in config.missing_required_settings())


def test_the_other_providers_key_is_not_required(monkeypatch):
    """Running on Claude shouldn't demand an Anthropic key be set twice over."""
    _set(monkeypatch, LLM_PROVIDER="anthropic", ANTHROPIC_API_KEY="k", OPENAI_API_KEY="k")
    assert config.missing_required_settings() == []


def test_openai_key_is_required_even_on_claude(monkeypatch):
    """Speech-to-text and the recall embeddings are OpenAI either way."""
    _set(monkeypatch, LLM_PROVIDER="anthropic", ANTHROPIC_API_KEY="k", OPENAI_API_KEY="")
    assert any("OPENAI_API_KEY" in m for m in config.missing_required_settings())


def test_a_misspelled_provider_is_caught(monkeypatch):
    _set(monkeypatch, LLM_PROVIDER="claude", OPENAI_API_KEY="k")
    assert any("LLM_PROVIDER" in m for m in config.missing_required_settings())


def test_the_app_refuses_to_boot_when_something_is_missing(monkeypatch):
    """The whole point: bad config kills the process instead of the request."""
    from app import main

    monkeypatch.setattr(config, "missing_required_settings", lambda: ["OPENAI_API_KEY"])
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        main._check_settings()


def test_the_writing_calls_get_a_longer_budget_than_a_reply(monkeypatch):
    """A reply streams and should fail fast when it stalls; the reading and the
    fact extraction are one-shot calls that run to a thousand words, and timing
    them out at the reply's budget fails the button while the model is still
    working."""
    from app.services import chat_model

    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "test-key")

    assert chat_model.WRITE_TIMEOUT > chat_model.REPLY_TIMEOUT
    assert chat_model.build_chat_model().request_timeout == chat_model.REPLY_TIMEOUT
    assert (
        chat_model.build_chat_model(timeout=chat_model.WRITE_TIMEOUT).request_timeout
        == chat_model.WRITE_TIMEOUT
    )
