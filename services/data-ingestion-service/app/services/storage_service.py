"""
Storage service: abstracts file I/O.
Currently uses a local Docker volume; can be swapped for S3 by changing these methods.
"""

import os

import pandas as pd


def load_dataframe(file_path: str) -> pd.DataFrame:
    """Load a CSV, Excel, or Parquet file into a DataFrame."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".csv",):
        return pd.read_csv(file_path)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    elif ext in (".parquet",):
        return pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def save_uploaded_file(
    file_obj, dataset_id: str, filename: str, upload_folder: str
) -> str:
    """Save an uploaded file to the upload folder. Returns the absolute path."""
    dest_dir = os.path.join(upload_folder, dataset_id)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, filename)
    file_obj.save(dest_path)
    return dest_path


def encrypt_value(plaintext: str) -> str:
    """Fernet-encrypt a string. Returns base64-encoded ciphertext."""
    from cryptography.fernet import Fernet

    key = _get_fernet_key()
    f = Fernet(key)
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Fernet-decrypt a string."""
    from cryptography.fernet import Fernet

    key = _get_fernet_key()
    f = Fernet(key)
    return f.decrypt(ciphertext.encode()).decode()


def _get_fernet_key() -> bytes:
    key = os.environ.get("FERNET_KEY", "")
    if not key:
        raise RuntimeError("FERNET_KEY environment variable not set")
    return key.encode()
