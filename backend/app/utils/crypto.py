"""Cryptography utilities for encrypting/decrypting API keys."""
import os
from cryptography.fernet import Fernet
from flask import current_app


def get_encryption_key():
    """Get encryption key from environment or generate one."""
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        # Generate a key if none exists (for development only)
        # In production, this should be set as an environment variable
        key = Fernet.generate_key().decode()
        current_app.logger.warning(
            "No ENCRYPTION_KEY found in environment. Using generated key. "
            "This should only happen in development!"
        )
    return key.encode() if isinstance(key, str) else key


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage."""
    key = get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(api_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage."""
    key = get_encryption_key()
    f = Fernet(key)
    # Handle both string and bytes input
    if isinstance(encrypted_key, str):
        encrypted_key = encrypted_key.encode()
    decrypted = f.decrypt(encrypted_key)
    # Ensure we return a string
    if isinstance(decrypted, bytes):
        return decrypted.decode('utf-8')
    return str(decrypted)
