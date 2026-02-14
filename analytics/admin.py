from django.contrib import admin

from .models import UserPerformance


@admin.register(UserPerformance)
class UserPerformanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'challenge', 'score', 'accuracy', 'time_spent_seconds', 'created_at')
    search_fields = ('user__username', 'challenge__title')

# Register your models here.
