"""
Feature limit definitions per subscription tier.
Returns 402 Payment Required when a limit is exceeded.
"""

from flask import jsonify

TIER_LIMITS: dict = {
    "free": {
        "max_datasets": 3,
        "max_file_mb": 10,
        "preprocessing": True,
        "sql_connector": False,
    },
    "solo": {
        "max_datasets": 20,
        "max_file_mb": 100,
        "preprocessing": True,
        "sql_connector": True,
    },
    "company": {
        "max_datasets": -1,  # unlimited
        "max_file_mb": 500,
        "preprocessing": True,
        "sql_connector": True,
    },
    "super_admin": {
        "max_datasets": -1,
        "max_file_mb": 500,
        "preprocessing": True,
        "sql_connector": True,
    },
}

_DEFAULT = TIER_LIMITS["free"]


def get_limits(tier: str) -> dict:
    return TIER_LIMITS.get(tier, _DEFAULT)


def check_dataset_upload_limit(mongo, user_id: str, tier: str):
    """
    Returns a 402 response tuple if the user has reached their dataset limit,
    otherwise returns None.
    """
    limits = get_limits(tier)
    max_ds = limits["max_datasets"]
    if max_ds == -1:
        return None

    count = mongo.get_collection("datasets").count_documents(
        {"user_id": user_id, "status": {"$ne": "deleted"}}
    )
    if count >= max_ds:
        return (
            jsonify(
                {
                    "error": "limit_exceeded",
                    "limit": "max_datasets",
                    "max": max_ds,
                    "current": count,
                    "upgrade_required": True,
                }
            ),
            402,
        )
    return None


def check_file_size_limit(size_bytes: int, tier: str):
    """
    Returns a 402 response tuple if the file exceeds the tier's size limit,
    otherwise returns None.
    """
    limits = get_limits(tier)
    max_mb = limits["max_file_mb"]
    max_bytes = max_mb * 1024 * 1024
    if size_bytes > max_bytes:
        return (
            jsonify(
                {
                    "error": "limit_exceeded",
                    "limit": "max_file_size_mb",
                    "max_mb": max_mb,
                    "upgrade_required": True,
                }
            ),
            402,
        )
    return None


def check_feature(feature: str, tier: str):
    """
    Returns a 402 response tuple if the feature is not available on this tier,
    otherwise returns None.
    """
    limits = get_limits(tier)
    if not limits.get(feature, False):
        return (
            jsonify(
                {
                    "error": "feature_not_available",
                    "feature": feature,
                    "tier": tier,
                    "upgrade_required": True,
                }
            ),
            402,
        )
    return None
