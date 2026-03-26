from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('battle', '0002_battlematch_challenge_battlematch_preferred_topic'),
    ]

    operations = [
        migrations.AddField(
            model_name='battlematch',
            name='mode',
            field=models.CharField(
                choices=[('pvp', 'Online Opponent'), ('bot', 'Computer')],
                default='pvp',
                max_length=12,
            ),
        ),
    ]
