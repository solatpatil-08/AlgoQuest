from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'level', 'xp', 'preferred_language', 'experience_level', 'updated_at')
    search_fields = ('user__username', 'user__email', 'preferred_language', 'coding_interests')

# Register your models here.
