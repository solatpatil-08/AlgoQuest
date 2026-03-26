from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('battle', '0004_battlematch_bot_round_state'),
    ]

    operations = [
        migrations.AddField(
            model_name='battlematch',
            name='bot_round_status',
            field=models.CharField(
                choices=[('ready', 'Ready'), ('running', 'Running')],
                default='ready',
                max_length=16,
            ),
        ),
    ]
