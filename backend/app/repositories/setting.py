"""
MessMate Settings Repository Interface
======================================
Defines persistence operations for institutional configuration and system parameters.
"""

from abc import ABC, abstractmethod
from app.schemas.setting import InstitutionSettingSchema, InstitutionSettingUpdate


class ISettingsRepository(ABC):
    @abstractmethod
    async def get_settings(self) -> InstitutionSettingSchema:
        """
        Retrieves current institutional parameters.
        Initializes with documented defaults if no configuration record exists yet.
        """
        pass

    @abstractmethod
    async def update_settings(
        self, update_data: InstitutionSettingUpdate
    ) -> InstitutionSettingSchema:
        """
        Updates institutional parameters persistently and returns the saved configuration.
        """
        pass
