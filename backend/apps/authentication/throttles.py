"""
authentication/throttles.py — Per-user rate limiting throttle classes.

Each class reads its rate from settings.THROTTLE_RATES, falling back
to a sensible default.  Rates are DRF-format strings like '10/hour'.
"""
from django.conf import settings
from rest_framework.throttling import UserRateThrottle


class AnalyzeRepositoryThrottle(UserRateThrottle):
    scope = 'analyze_repository'

    def get_rate(self):
        rates = getattr(settings, 'THROTTLE_RATES', {})
        return rates.get(self.scope, '10/hour')


class ChatThrottle(UserRateThrottle):
    scope = 'chat'

    def get_rate(self):
        rates = getattr(settings, 'THROTTLE_RATES', {})
        return rates.get(self.scope, '200/day')


class ArchitectureThrottle(UserRateThrottle):
    scope = 'architecture'

    def get_rate(self):
        rates = getattr(settings, 'THROTTLE_RATES', {})
        return rates.get(self.scope, '50/day')


class RepositoryOverviewThrottle(UserRateThrottle):
    scope = 'repository_overview'

    def get_rate(self):
        rates = getattr(settings, 'THROTTLE_RATES', {})
        return rates.get(self.scope, '300/day')
