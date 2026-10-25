"""Readiness must not initialise slow native inference libraries."""
import builtins
import sys
import unittest
from unittest import mock

import motion_runtime


class MotionReadinessTests(unittest.TestCase):
    def test_installed_packages_are_reported_without_importing_native_libraries(self):
        original_import = builtins.__import__

        def guard(name, *args, **kwargs):
            if name.split('.')[0] in ('cv2', 'rtmlib', 'onnxruntime'):
                self.fail('Readiness tried to initialise native motion libraries')
            return original_import(name, *args, **kwargs)

        with mock.patch.object(motion_runtime.importlib.util, 'find_spec', return_value=object()), \
                mock.patch.dict(sys.modules, {'onnxruntime': None}), \
                mock.patch('builtins.__import__', side_effect=guard):
            result = motion_runtime.status()
        self.assertTrue(result['available'])
        self.assertEqual(result['providers'], [])

    def test_missing_optional_dependency_is_actionable(self):
        with mock.patch.object(motion_runtime.importlib.util, 'find_spec',
                               side_effect=lambda name: None if name == 'cv2' else object()):
            result = motion_runtime.status()
        self.assertFalse(result['available'])
        self.assertEqual(result['missing'], ['cv2'])
        self.assertIn('Windows preview', result['message'])

    def test_provider_details_only_use_an_already_loaded_runtime(self):
        ort = mock.Mock()
        ort.get_available_providers.return_value = ['CPUExecutionProvider']
        with mock.patch.object(motion_runtime.importlib.util, 'find_spec', return_value=object()), \
                mock.patch.dict(sys.modules, {'onnxruntime': ort}):
            self.assertEqual(motion_runtime.status()['providers'], ['CPUExecutionProvider'])
