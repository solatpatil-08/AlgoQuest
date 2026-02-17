"""Management command to load challenge bank from JSON into database."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from challenges.models import Topic, Challenge
from challenges.validators import ChallengeBankValidationError, validate_challenge_bank


class Command(BaseCommand):
    help = 'Load challenge bank from challenges/data/challenge_bank.json into database.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Clear existing topics and challenges before loading (use carefully)',
        )
        parser.add_argument(
            '--validate-only',
            action='store_true',
            help='Validate JSON without loading into database',
        )

    def handle(self, *args, **options):
        bank_file = Path('challenges/data/challenge_bank.json')
        
        if not bank_file.exists():
            raise CommandError(f'Challenge bank file not found: {bank_file}')
        
        # Validate first
        self.stdout.write('Validating challenge bank JSON...')
        try:
            validate_challenge_bank(str(bank_file))
            self.stdout.write(self.style.SUCCESS('✓ Challenge bank JSON is valid'))
        except ChallengeBankValidationError as e:
            raise CommandError(str(e))
        
        if options['validate_only']:
            self.stdout.write(self.style.SUCCESS('Validation complete. No changes made.'))
            return
        
        # Load JSON
        with open(bank_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Reset if requested
        if options['reset']:
            self.stdout.write('Clearing existing topics and challenges...')
            Topic.objects.all().delete()
            Challenge.objects.all().delete()
            self.stdout.write(self.style.WARNING('✓ Cleared all topics and challenges'))
        
        # Load topics and challenges
        topics_created = 0
        challenges_created = 0
        challenges_updated = 0
        
        for topic_data in data.get('topics', []):
            # Create or get topic
            topic, topic_created = Topic.objects.get_or_create(
                stable_id=topic_data['stable_id'],
                defaults={
                    'label': topic_data['label'],
                    'category': topic_data['category'],
                    'description': topic_data['description'],
                    'icon_class': topic_data.get('icon_class', 'bi-puzzle'),
                    'visualization_type': topic_data.get('visualization_type', 'conceptual'),
                    'is_active': True,
                },
            )
            if topic_created:
                topics_created += 1
            
            # Create challenges for this topic
            for chal_data in topic_data.get('challenges', []):
                # Use compound key: (topic_id, order_index) for uniqueness per topic
                challenge, chal_created = Challenge.objects.update_or_create(
                    topic=topic,
                    order_index=chal_data['order_index'],
                    defaults={
                        'title': chal_data['title'],
                        'challenge_type': Challenge.ChallengeType.ALGORITHM,
                        'difficulty': chal_data['difficulty'],
                        'description': chal_data['description'],
                        'prompt': chal_data['prompt'],
                        'expected_answer': chal_data['expected_answer'],
                        'starter_code': chal_data.get('starter_code', ''),
                        'xp_reward': chal_data['xp_reward'],
                        'is_active': chal_data.get('is_active', True),
                        'is_visual_supported': topic.visualization_type != 'conceptual',
                    },
                )
                # Force slug regeneration based on new save logic (topic + title)
                if chal_created or not challenge.slug:
                    challenge.save()
                if chal_created:
                    challenges_created += 1
                else:
                    challenges_updated += 1
        
        self.stdout.write(self.style.SUCCESS(f'✓ Loaded {topics_created} new topics'))
        self.stdout.write(self.style.SUCCESS(f'✓ Created {challenges_created} new challenges'))
        self.stdout.write(self.style.SUCCESS(f'✓ Updated {challenges_updated} existing challenges'))
        self.stdout.write(self.style.SUCCESS('Challenge bank loaded successfully!'))
