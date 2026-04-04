"""Feature limit definitions per subscription tier for ml-training-service."""

from flask import jsonify

TIER_LIMITS: dict = {
    "free": {
        "max_pipelines": 2,
        "max_training_runs": 5,
        "batch_predictions": False,
        "model_comparison": False,
        "max_models_per_pipeline": 3,
    },
    "solo": {
        "max_pipelines": 10,
        "max_training_runs": 50,
        "batch_predictions": True,
        "model_comparison": True,
        "max_models_per_pipeline": 20,
    },
    "company": {
        "max_pipelines": -1,
        "max_training_runs": -1,
        "batch_predictions": True,
        "model_comparison": True,
        "max_models_per_pipeline": -1,
    },
    "super_admin": {
        "max_pipelines": -1,
        "max_training_runs": -1,
        "batch_predictions": True,
        "model_comparison": True,
        "max_models_per_pipeline": -1,
    },
}

_DEFAULT = TIER_LIMITS["free"]


def get_limits(tier: str) -> dict:
    return TIER_LIMITS.get(tier, _DEFAULT)


def check_pipeline_limit(db, user_id: str, tier: str):
    limits = get_limits(tier)
    max_p = limits["max_pipelines"]
    if max_p == -1:
        return None
    count = db["pipelines"].count_documents({"user_id": user_id})
    if count >= max_p:
        return (
            jsonify(
                {
                    "error": "limit_exceeded",
                    "limit": "max_pipelines",
                    "max": max_p,
                    "current": count,
                    "upgrade_required": True,
                }
            ),
            402,
        )
    return None


def check_training_run_limit(db, user_id: str, tier: str):
    limits = get_limits(tier)
    max_r = limits["max_training_runs"]
    if max_r == -1:
        return None
    count = db["model_versions"].count_documents({"user_id": user_id})
    if count >= max_r:
        return (
            jsonify(
                {
                    "error": "limit_exceeded",
                    "limit": "max_training_runs",
                    "max": max_r,
                    "current": count,
                    "upgrade_required": True,
                }
            ),
            402,
        )
    return None


def check_feature(feature: str, tier: str):
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
