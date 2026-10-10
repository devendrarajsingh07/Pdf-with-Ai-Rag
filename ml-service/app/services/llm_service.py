from google import genai
from google.genai import types
from app.core.config import settings
from app.rag.prompts import SYSTEM_PROMPT, build_rag_prompt
from loguru import logger
import time
from app.core.provider_control import provider_control, ProviderLimited, generation_model

class GenerationUnavailable(RuntimeError):
    pass

class LLMService:
    def __init__(self):
        self._client = None
    
    def _get_client(self):
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        if self._client is None:
            self._client = genai.Client(api_key=settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=90000, retry_options=types.HttpRetryOptions(attempts=1)))
        return self._client
    
    def generate(
        self,
        question: str,
        context: str,
        conversation_history: list[dict] = None
    ) -> str:
        if not context:
            return "The uploaded documents do not contain enough information to answer this question reliably."
        
        prompt = build_rag_prompt(question, context, conversation_history)
        models = list(dict.fromkeys([settings.llm_model, *[model.strip() for model in settings.llm_fallback_models.split(',') if model.strip()]]))
        
        last_error = None
        for attempt, model in enumerate(models):
            try:
                key = provider_control.cache_key(model, {'prompt': prompt, 'system': SYSTEM_PROMPT,
                    'temperature': settings.llm_temperature, 'limit': settings.llm_max_output_tokens})
                cached = provider_control.get(key)
                if cached is not None:
                    provider_control.audit('generation-cache-hit', model)
                    generation_model.set(model)
                    return cached
                provider_control.reserve(model, len(prompt) // 3 + settings.llm_max_output_tokens)
                response = self._get_client().models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=settings.llm_temperature,
                        max_output_tokens=settings.llm_max_output_tokens,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
                if not response.text:
                    raise RuntimeError("Gemini returned an empty response")
                provider_control.put(key, response.text)
                provider_control.audit('generation-completed', model)
                generation_model.set(model)
                return response.text
            except Exception as error:
                last_error = error
                code = getattr(error, 'code', None)
                provider_control.audit('generation-attempt-failed', model, code=code or type(error).__name__)
                logger.warning('Generation attempt unavailable: model={}, code={}', model, code or type(error).__name__)
                # Do not use fallback to evade invalid credentials, malformed input or safety refusal.
                if not isinstance(error, ProviderLimited) and code not in (429, 500, 502, 503, 504):
                    break
                if attempt + 1 < len(models):
                    time.sleep(min(4, 2 ** attempt))

        logger.error('All permitted generation attempts failed')
        raise GenerationUnavailable("Answer generation is temporarily unavailable") from last_error

llm_service = LLMService()
