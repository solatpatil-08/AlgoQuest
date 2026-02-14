from django.contrib import admin

from .models import BattleMatch


@admin.register(BattleMatch)
class BattleMatchAdmin(admin.ModelAdmin):
    list_display = (
        'room_code',
        'player_one',
        'player_two',
        'status',
        'player_one_score',
        'player_two_score',
        'winner',
    )
    list_filter = ('status',)
    search_fields = ('room_code', 'player_one__username', 'player_two__username')

# Register your models here.
