"""Types for provider routing recommendations."""

from dataclasses import dataclass


@dataclass
class ProviderRecommendation:
    """Recommendation for a single execution phase."""

    provider_type: str
    model: str
    reason: str
    confidence: float  # 0.0 - 1.0


@dataclass
class RoutingRecommendation:
    """Provider recommendation across core phases."""

    planning: ProviderRecommendation
    coding: ProviderRecommendation
    qa: ProviderRecommendation

