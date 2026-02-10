#!/usr/bin/env python3
"""Verification script for backend provider registration and initialization."""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "apps" / "backend"
sys.path.insert(0, str(backend_dir))

def test_provider_types():
    """Test that all provider types are defined."""
    from core.providers.types import ProviderType

    print("✓ Testing ProviderType enum...")
    expected_providers = ['CLAUDE', 'GEMINI', 'OPENAI', 'OPENCODE']

    for provider_name in expected_providers:
        assert hasattr(ProviderType, provider_name), f"Missing {provider_name}"
        print(f"  ✓ {provider_name} exists")

    print(f"  Total providers: {len(list(ProviderType))}")
    return True

def test_provider_registry():
    """Test that all providers are registered."""
    from core.providers import ProviderRegistry, ProviderType

    print("\n✓ Testing ProviderRegistry...")
    available = ProviderRegistry.list_available()

    expected = [ProviderType.CLAUDE, ProviderType.GEMINI, ProviderType.OPENAI, ProviderType.OPENCODE]

    for provider_type in expected:
        assert provider_type in available, f"{provider_type} not in registry"
        print(f"  ✓ {provider_type.value} registered")

    return True

def test_provider_factories():
    """Test that factories can be retrieved for all providers."""
    from core.providers import ProviderRegistry, ProviderType

    print("\n✓ Testing Provider Factories...")
    providers = [ProviderType.CLAUDE, ProviderType.GEMINI, ProviderType.OPENAI, ProviderType.OPENCODE]

    for provider_type in providers:
        factory = ProviderRegistry.get_factory(provider_type)
        assert factory is not None, f"No factory for {provider_type}"
        print(f"  ✓ {provider_type.value} factory retrieved")

    return True

def test_provider_imports():
    """Test that all provider classes can be imported."""
    print("\n✓ Testing Provider Imports...")

    try:
        from core.providers import ClaudeCLIProvider
        print("  ✓ ClaudeCLIProvider imported")
    except ImportError as e:
        print(f"  ✗ ClaudeCLIProvider import failed: {e}")
        return False

    try:
        from core.providers import GeminiCLIProvider
        print("  ✓ GeminiCLIProvider imported")
    except ImportError as e:
        print(f"  ✗ GeminiCLIProvider import failed: {e}")
        return False

    try:
        from core.providers import OpenAICLIProvider
        print("  ✓ OpenAICLIProvider imported")
    except ImportError as e:
        print(f"  ✗ OpenAICLIProvider import failed: {e}")
        return False

    try:
        from core.providers.opencode import OpencodeCLIProvider
        print("  ✓ OpencodeCLIProvider imported")
    except ImportError as e:
        print(f"  ✗ OpencodeCLIProvider import failed: {e}")
        return False

    return True

def test_opencode_provider_creation():
    """Test Opencode provider can be instantiated."""
    from core.providers.opencode import OpencodeCLIProvider

    print("\n✓ Testing Opencode Provider Creation...")

    try:
        provider_instance = OpencodeCLIProvider.create(None)
        assert provider_instance is not None
        print("  ✓ OpencodeCLIProvider created successfully")
        print(f"  ✓ Provider type: {provider_instance.provider_type}")
        return True
    except Exception as e:
        print(f"  ✗ Failed to create OpencodeCLIProvider: {e}")
        return False

def main():
    """Run all verification tests."""
    print("=" * 60)
    print("Backend Provider Registration & Initialization Verification")
    print("=" * 60)

    tests = [
        ("Provider Types", test_provider_types),
        ("Provider Registry", test_provider_registry),
        ("Provider Factories", test_provider_factories),
        ("Provider Imports", test_provider_imports),
        ("Opencode Creation", test_opencode_provider_creation),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗ {test_name} FAILED: {e}")
            results.append((test_name, False))

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n✓ ALL PROVIDER TESTS PASSED")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
