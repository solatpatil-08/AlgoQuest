from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('battle', '0003_battlematch_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='battlematch',
            name='bot_next_solve_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='battlematch',
            name='used_challenge_ids',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
