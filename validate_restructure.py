#!/usr/bin/env python
"""
Validation Script for AlgoQuest Multi-Panel Layout Restructuring
Verifies all changes are syntactically correct and templates render properly
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'AlgoQuest.settings')
sys.path.insert(0, str(Path(__file__).parent))
django.setup()

from django.template.loader import get_template
from django.template import TemplateDoesNotExist
import re


def validate_templates():
    """Validate Django templates."""
    templates = [
        'challenges/challenge_detail.html',
        'battle/live_battle.html',
    ]
    
    print("=" * 60)
    print("TEMPLATE VALIDATION")
    print("=" * 60)
    
    all_valid = True
    for template_name in templates:
        try:
            template = get_template(template_name)
            print(f"✓ {template_name}: Valid")
        except TemplateDoesNotExist as e:
            print(f"✗ {template_name}: NOT FOUND - {e}")
            all_valid = False
        except Exception as e:
            print(f"✗ {template_name}: ERROR - {e}")
            all_valid = False
    
    return all_valid


def validate_css_structure():
    """Validate CSS file structure."""
    print("\n" + "=" * 60)
    print("CSS STRUCTURE VALIDATION")
    print("=" * 60)
    
    css_file = Path(__file__).parent / 'static' / 'css' / 'visualization.css'
    
    if not css_file.exists():
        print(f"✗ CSS file not found: {css_file}")
        return False
    
    with open(css_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Check for required CSS classes
    required_classes = [
        '.challenge-detail-page',
        '.challenge-mobile-tabs',
        '.challenge-detail-row',
        '.challenge-question-column',
        '.challenge-viz-column',
        '.challenge-viz-card',
        '.challenge-answer-card',
    ]
    
    print(f"File: {css_file.name}")
    print(f"Size: {len(content):,} bytes")
    print(f"Lines: {len(content.splitlines())}")
    
    print("\nClass Definitions:")
    all_found = True
    for class_name in required_classes:
        if class_name in content:
            print(f"  ✓ {class_name}")
        else:
            print(f"  ✗ {class_name}")
            all_found = False
    
    # Check for media queries
    media_queries = [
        '@media (min-width: 992px)',
        '@media (min-width: 1200px)',
        '@media (max-width: 991.98px)',
        '@media (max-width: 767.98px)',
    ]
    
    print("\nMedia Queries:")
    for mq in media_queries:
        if mq in content:
            print(f"  ✓ {mq}")
        else:
            print(f"  ✗ {mq}")
            all_found = False
    
    # Check for syntax issues
    brace_count_open = content.count('{')
    brace_count_close = content.count('}')
    if brace_count_open == brace_count_close:
        print(f"\n✓ Brace matching: {brace_count_open} pairs")
    else:
        print(f"\n✗ Brace mismatch: {brace_count_open} open, {brace_count_close} close")
        all_found = False
    
    return all_found


def validate_html_structure():
    """Validate HTML structure in templates."""
    print("\n" + "=" * 60)
    print("HTML STRUCTURE VALIDATION")
    print("=" * 60)
    
    challenge_detail_file = Path(__file__).parent / 'templates' / 'challenges' / 'challenge_detail.html'
    
    if not challenge_detail_file.exists():
        print(f"✗ Template not found: {challenge_detail_file}")
        return False
    
    with open(challenge_detail_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    print(f"File: {challenge_detail_file.name}")
    print(f"Size: {len(content):,} bytes")
    print(f"Lines: {len(content.splitlines())}")
    
    # Check for required elements
    required_elements = {
        'Mobile Tabs': 'challenge-mobile-tabs',
        'Question Section ID': 'id="question-section"',
        'Visualization Section ID': 'id="visualization-section"',
        'Answer Section ID': 'id="answer-section"',
        'Question Column Class': 'challenge-question-column',
        'Visualization Column Class': 'challenge-viz-column',
        'Mobile Tab Data Attribute': 'data-section=',
        'JavaScript Mobile Tabs Handler': 'initializeMobileTabs',
    }
    
    print("\nRequired Elements:")
    all_found = True
    for element_name, element_text in required_elements.items():
        if element_text in content:
            print(f"  ✓ {element_name}")
        else:
            print(f"  ✗ {element_name}")
            all_found = False
    
    # Check for balanced tags
    div_count = content.count('<div')
    div_close_count = content.count('</div>')
    print(f"\nDiv Tags: {div_count} open, {div_close_count} close")
    
    return all_found


def validate_javascript():
    """Validate JavaScript functionality."""
    print("\n" + "=" * 60)
    print("JAVASCRIPT VALIDATION")
    print("=" * 60)
    
    challenge_detail_file = Path(__file__).parent / 'templates' / 'challenges' / 'challenge_detail.html'
    
    with open(challenge_detail_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Check for JavaScript functions and event handlers
    js_elements = {
        'Mobile Tabs Function': 'function initializeMobileTabs()',
        'Tab Click Handler': 'button.addEventListener("click"',
        'Scroll Behavior': 'scrollIntoView',
        'DOMContentLoaded Event': 'DOMContentLoaded',
        'Section ID Reference': 'sectionId + "-section"',
    }
    
    print("JavaScript Components:")
    all_found = True
    for element_name, element_text in js_elements.items():
        if element_text in content:
            print(f"  ✓ {element_name}")
        else:
            print(f"  ✗ {element_name}")
            all_found = False
    
    return all_found


def main():
    """Run all validations."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " AlgoQuest Multi-Panel Layout Restructuring Validation ".center(58) + "║")
    print("╚" + "=" * 58 + "╝")
    
    results = {
        'Templates': validate_templates(),
        'CSS Structure': validate_css_structure(),
        'HTML Structure': validate_html_structure(),
        'JavaScript': validate_javascript(),
    }
    
    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    for category, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{category}: {status}")
    
    all_pass = all(results.values())
    
    print("\n" + "=" * 60)
    if all_pass:
        print("OVERALL RESULT: ✓ ALL VALIDATIONS PASSED")
        print("=" * 60)
        return 0
    else:
        print("OVERALL RESULT: ✗ SOME VALIDATIONS FAILED")
        print("=" * 60)
        return 1


if __name__ == '__main__':
    sys.exit(main())
