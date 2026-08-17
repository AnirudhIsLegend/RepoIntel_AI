from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'github_username', 'github_id', 'created_at']
    search_fields = ['github_username', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
