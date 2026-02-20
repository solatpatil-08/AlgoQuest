"""Management command to load challenge bank from JSON into database."""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from challenges.models import Challenge, Topic
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

        self.stdout.write('Validating challenge bank JSON...')
        try:
            validate_challenge_bank(str(bank_file))
            self.stdout.write(self.style.SUCCESS('[OK] Challenge bank JSON is valid'))
        except ChallengeBankValidationError as exc:
            raise CommandError(str(exc))

        if options['validate_only']:
            self.stdout.write(self.style.SUCCESS('Validation complete. No changes made.'))
            return

        with open(bank_file, 'r', encoding='utf-8') as handle:
            data = json.load(handle)

        if options['reset']:
            self.stdout.write('Clearing existing topics and challenges...')
            Topic.objects.all().delete()
            Challenge.objects.all().delete()
            self.stdout.write(self.style.WARNING('[OK] Cleared all topics and challenges'))

        topics_created = 0
        topics_updated = 0
        challenges_created = 0
        challenges_updated = 0

        for topic_data in data.get('topics', []):
            topic, topic_created = Topic.objects.update_or_create(
                stable_id=topic_data['stable_id'],
                defaults={
                    'label': topic_data['label'],
                    'category': topic_data['category'],
                    'description': topic_data['description'],
                    'icon_class': topic_data.get('icon_class', 'bi-puzzle'),
                    'visualization_type': topic_data.get('visualization_type', 'conceptual'),
                    'is_active': topic_data.get('is_active', True),
                },
            )
            if topic_created:
                topics_created += 1
            else:
                topics_updated += 1

            for challenge_data in topic_data.get('challenges', []):
                challenge, challenge_created = Challenge.objects.update_or_create(
                    topic=topic,
                    order_index=challenge_data['order_index'],
                    defaults={
                        'title': challenge_data['title'],
                        'challenge_type': Challenge.ChallengeType.ALGORITHM,
                        'algorithm_type': challenge_data['algorithm_type'],
                        'difficulty': challenge_data['difficulty'],
                        'description': challenge_data['description'],
                        'prompt': challenge_data['prompt'],
                        'expected_answer': challenge_data['expected_answer'],
                        'starter_code': challenge_data.get('starter_code', ''),
                        'visualization_payload': challenge_data.get('visualization_payload', {}),
                        'xp_reward': challenge_data['xp_reward'],
                        'is_active': challenge_data.get('is_active', True),
                        'is_visual_supported': topic.visualization_type != 'conceptual',
                    },
                )

                desired_slug = slugify(f'{topic.stable_id}-{challenge.title}')
                if challenge.slug != desired_slug:
                    challenge.slug = desired_slug
                    challenge.save(update_fields=['slug'])

                if challenge_created:
                    challenges_created += 1
                else:
                    challenges_updated += 1

        self.stdout.write(self.style.SUCCESS(f'[OK] Loaded {topics_created} new topics'))
        self.stdout.write(self.style.SUCCESS(f'[OK] Updated {topics_updated} existing topics'))
        self.stdout.write(self.style.SUCCESS(f'[OK] Created {challenges_created} new challenges'))
        self.stdout.write(self.style.SUCCESS(f'[OK] Updated {challenges_updated} existing challenges'))
        self.stdout.write(self.style.SUCCESS('Challenge bank loaded successfully!'))
