#!/usr/bin/env python3
"""
BATCH C - Final Verification Checklist & Run Commands
AlgoQuest Challenge System - Complete DSA + AI/ML Curriculum
"""

import subprocess
import sys
import json
from pathlib import Path

class VerificationChecklist:
    def __init__(self):
        self.checks_passed = []
        self.checks_failed = []
        self.project_root = Path("c:\\Users\\Hp\\DjangoProjects\\AlgoQuest")
        
    def check_files_exist(self):
        """Verify all necessary files exist."""
        files_to_check = [
            "challenges/models.py",
            "challenges/views.py",
            "challenges/tests.py",
            "challenges/tests_batch_b.py",
            "challenges/management/commands/load_challenge_bank.py",
            "challenges/data/challenge_bank.json",
            "challenges/migrations/0003_topic_and_userchallengeprog.py",
            "templates/challenges/challenge_list.html",
            "templates/challenges/challenge_detail.html",
            "templates/challenges/challenge_locked.html",
            "static/js/visualization-conceptual.js",
        ]
        
        for file in files_to_check:
            path = self.project_root / file
            if path.exists():
                self.checks_passed.append(f"File exists: {file}")
            else:
                self.checks_failed.append(f"File missing: {file}")
    
    def check_challenge_bank(self):
        """Verify challenge bank structure and volume."""
        bank_path = self.project_root / "challenges/data/challenge_bank.json"
        with open(bank_path, 'r') as f:
            bank = json.load(f)
        
        total_challenges = sum(len(t.get('challenges', [])) for t in bank['topics'])
        num_topics = len(bank['topics'])
        
        if total_challenges >= 150:
            self.checks_passed.append(f"Challenge volume: {total_challenges} challenges ({num_topics} topics)")
        else:
            self.checks_failed.append(f"Challenge volume insufficient: {total_challenges} (target: 150+)")
        
        # Check all topics have challenges
        if all(len(t.get('challenges', [])) > 0 for t in bank['topics']):
            self.checks_passed.append("All topics have challenges")
        else:
            self.checks_failed.append("Some topics have zero challenges")
    
    def check_models(self):
        """Verify models are properly created."""
        try:
            from challenges.models import Topic, UserChallengeProg, Challenge
            
            # Test Topic model
            topics = Topic.objects.count()
            self.checks_passed.append(f"Topic model exists (database: {topics} topics)")
            
            # Test UserChallengeProg model
            self.checks_passed.append("UserChallengeProg model exists")
            
            # Test Challenge extensions
            sample = Challenge.objects.filter(is_active=True).first()
            if sample and hasattr(sample, 'topic'):
                self.checks_passed.append("Challenge model extended with topic FK")
            
        except Exception as e:
            self.checks_failed.append(f"Model error: {str(e)}")
    
    def run_tests(self):
        """Run BATCH A + BATCH B tests."""
        result = subprocess.run(
            [sys.executable, "manage.py", "test", "challenges.tests", "challenges.tests_batch_b", "-v", "0"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0 and "OK" in result.stdout:
            # Count tests
            for line in result.stdout.split('\n'):
                if 'Ran' in line:
                    self.checks_passed.append(f"Tests: {line.strip()}")
                    self.checks_passed.append("Status: ALL PASSED ✅")
                    break
        else:
            self.checks_failed.append(f"Test failure: {result.stderr}")
    
    def print_report(self):
        """Print verification report."""
        print("\n" + "=" * 70)
        print("ALGOQUEST BATCH C - FINAL VERIFICATION REPORT")
        print("=" * 70 + "\n")
        
        print("✅ PASSED CHECKS:")
        for check in self.checks_passed:
            print(f"  ✓ {check}")
        
        if self.checks_failed:
            print(f"\n❌ FAILED CHECKS ({len(self.checks_failed)}):")
            for check in self.checks_failed:
                print(f"  ✗ {check}")
        
        print("\n" + "=" * 70)
        status = "✅ VERIFICATION COMPLETE" if not self.checks_failed else "⚠️ ISSUES FOUND"
        print(f"{status}")
        print("=" * 70 + "\n")

if __name__ == "__main__":
    # Change to project directory
    import os
    os.chdir(str(Path("c:\\Users\\Hp\\DjangoProjects\\AlgoQuest")))
    
    checker = VerificationChecklist()
    print("\nRunning verification checks...")
    
    try:
        checker.check_files_exist()
        checker.check_challenge_bank()
        checker.check_models()
        checker.run_tests()
    except Exception as e:
        print(f"Verification error: {e}")
    
    checker.print_report()
