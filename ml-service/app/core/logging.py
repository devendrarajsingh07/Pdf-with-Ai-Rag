from loguru import logger
import sys
from .config import settings

def setup_logging():
    logger.remove()
    logger.add(sys.stdout, level=settings.log_level, format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{line} | {message}")
    return logger
