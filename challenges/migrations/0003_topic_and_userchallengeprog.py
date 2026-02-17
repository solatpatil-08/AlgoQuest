# Generated migration for new Topic and UserChallengeProg models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('challenges', '0002_alter_challenge_algorithm_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stable_id', models.CharField(max_length=100, unique=True)),
                ('label', models.CharField(max_length=150)),
                ('category', models.CharField(choices=[('dsa_core', 'DSA Core'), ('sorting_searching', 'Sorting & Searching'), ('trees_graphs', 'Trees & Graphs'), ('advanced_dsa', 'Advanced DSA'), ('ai_ml', 'AI/ML')], max_length=20)),
                ('description', models.TextField()),
                ('icon_class', models.CharField(default='bi-puzzle', max_length=50)),
                ('visualization_type', models.CharField(choices=[('array', 'Array'), ('graph', 'Graph'), ('tree', 'Tree'), ('grid', 'Grid'), ('matrix', 'Matrix'), ('conceptual', 'Conceptual'), ('none', 'None')], default='conceptual', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ('category', 'label'),
            },
        ),
        migrations.AddField(
            model_name='challenge',
            name='topic',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='challenges', to='challenges.topic'),
        ),
        migrations.AddField(
            model_name='challenge',
            name='order_index',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='challenge',
            name='is_visual_supported',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='UserChallengeProg',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_solved', models.BooleanField(default=False)),
                ('is_unlocked', models.BooleanField(default=False)),
                ('solved_at', models.DateTimeField(blank=True, null=True)),
                ('best_score', models.PositiveIntegerField(default=0)),
                ('attempt_count', models.PositiveIntegerField(default=0)),
                ('first_attempted_at', models.DateTimeField(blank=True, null=True)),
                ('last_attempted_at', models.DateTimeField(blank=True, null=True)),
                ('challenge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_progress', to='challenges.challenge')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='challenge_progress', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('challenge__order_index',),
                'unique_together': {('user', 'challenge')},
            },
        ),
    ]
