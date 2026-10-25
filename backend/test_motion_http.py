"""Exercise authenticated streaming, cancellation and video spool cleanup."""
import http.client
import json
from pathlib import Path
import threading
import unittest
from unittest import mock

import server
import motion_runtime


class MotionHTTPTests(unittest.TestCase):
    def setUp(self):
        self.server = server.LocalServer(('127.0.0.1', 0), server.ProjectStore(server.WORKSPACE), server.APP, 'motion-test')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(5)

    def request(self, path, body=b'video', token='motion-test', job='a'*32):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        conn.request('POST', path, body, {'Authorization': f'Bearer {token}', 'X-Styk-Job-Id': job})
        response = conn.getresponse()
        status, data = response.status, response.read()
        conn.close()
        return status, data

    def test_stream_and_failure_clean_temporary_video(self):
        paths = []
        def capture(path, query, emit):
            paths.append(path)
            self.assertEqual(path.read_bytes(), b'video')
            emit({'type': 'stage', 'message': 'test'})
            raise ValueError('No valid frames')
        with mock.patch.object(motion_runtime, 'status', return_value={'available': True}), mock.patch.object(motion_runtime, 'capture', side_effect=capture):
            status, data = self.request('/api/motion/capture?duration=10')
        self.assertEqual(status, 200)
        packets = [json.loads(line) for line in data.splitlines()]
        self.assertEqual([p['type'] for p in packets], ['stage', 'error'])
        self.assertFalse(paths[0].exists())

    def test_cancel_before_upload_never_enters_inference(self):
        self.server.jobs.cancel('a'*32)
        with mock.patch.object(motion_runtime, 'capture') as capture:
            status, _ = self.request('/api/motion/capture')
        self.assertEqual(status, 499)
        capture.assert_not_called()

    def test_auth_and_optional_runtime(self):
        self.assertEqual(self.request('/api/motion/capture', token='wrong')[0], 401)
        with mock.patch.object(motion_runtime, 'status', return_value={'available': False, 'message': 'Install preview'}):
            status, data = self.request('/api/motion/capture')
        self.assertEqual(status, 503)
        self.assertIn(b'Install preview', data)
