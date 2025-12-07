from app import create_app
from app.models.entity import UserAPIKey, EnrichmentProvider
from app.utils.crypto import decrypt_api_key

app = create_app()
with app.app_context():
    uk = UserAPIKey.query.first()
    if not uk:
        print("No API keys found")
        exit()
    
    provider = EnrichmentProvider.query.get(uk.provider_id)
    print(f"Provider: {provider.name}")
    print(f"Encrypted key length: {len(uk.encrypted_key)}")
    
    try:
        decrypted = decrypt_api_key(uk.encrypted_key)
        print(f"Decryption SUCCESS")
        print(f"Decrypted type: {type(decrypted)}")
        if isinstance(decrypted, bytes):
            decrypted_str = decrypted.decode('utf-8')
            print(f"Decrypted as string length: {len(decrypted_str)}")
            print(f"First 10 chars: {decrypted_str[:10]}...")
        else:
            print(f"Decrypted length: {len(decrypted)}")
            print(f"First 10 chars: {str(decrypted)[:10]}...")
    except Exception as e:
        print(f"Decryption FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
