from . import config


def get_llm(temperature: float = 0):
    """Provider-agnostic LLM factory. Swap providers via LLM_PROVIDER env var
    without touching any graph/prompt code."""
    if config.LLM_PROVIDER == "anthropic":
        from langchain_anthropic import ChatAnthropic

        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set (see backend/.env.example)"
            )
        return ChatAnthropic(
            model=config.ANTHROPIC_MODEL,
            api_key=config.ANTHROPIC_API_KEY,
            temperature=temperature,
        )

    if config.LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI

        if not config.OPENAI_API_KEY:
            raise RuntimeError(
                "LLM_PROVIDER=openai but OPENAI_API_KEY is not set (see backend/.env.example)"
            )
        return ChatOpenAI(
            model=config.OPENAI_MODEL,
            api_key=config.OPENAI_API_KEY,
            temperature=temperature,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {config.LLM_PROVIDER!r} (expected 'anthropic' or 'openai')")
