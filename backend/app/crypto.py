"""Symmetric encryption for sensitive target fields.

The key is derived deterministically from ``settings.secret_key`` so every
self-hosted instance encrypts its own provider keys. Rotate ``SECRET_KEY``
only if you are prepared to re-enter all target API keys.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


_PREFIX = "$redfire$"


def _fernet() -> Fernet:
    raw = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_value(value: str) -> str:
    """Encrypt a plaintext string; empty values pass through unchanged."""
    if not value:
        return value
    return _PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_value(value: str | None) -> str:
    """Decrypt a ciphertext string. Legacy plaintext values pass through."""
    if not value:
        return ""
    if not isinstance(value, str) or not value.startswith(_PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except InvalidToken:
        return value
