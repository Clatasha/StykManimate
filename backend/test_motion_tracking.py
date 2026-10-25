import unittest
from motion_tracking import ActorTracker


def candidate(x, score=1):
    points = [[x + i % 2 * 10, 50 + i * 5] for i in range(17)]
    return points, [score] * 17


class TrackingTests(unittest.TestCase):
    def test_reversed_detector_order_does_not_reverse_actor_ids(self):
        tracker = ActorTracker(smoothing=0)
        first = tracker.update([candidate(100), candidate(700)], 0, 30, 1000)
        second = tracker.update([candidate(690), candidate(110)], 1, 30, 1000)
        self.assertEqual([a['id'] for a in first], [1, 2])
        self.assertEqual([a['id'] for a in second], [2, 1])

    def test_missing_actors_are_hidden_and_old_ids_expire(self):
        tracker = ActorTracker()
        tracker.update([candidate(100)], 0, 30, 1000)
        self.assertEqual(tracker.update([], 1, 30, 1000), [])
        self.assertEqual(tracker.update([candidate(100)], 30, 30, 1000)[0]['id'], 2)

    def test_low_confidence_is_marked_and_hidden_joints_do_not_freeze_forever(self):
        tracker = ActorTracker(smoothing=0)
        first = tracker.update([candidate(100)], 0, 30, 1000)[0]
        points, scores = candidate(120)
        scores[9] = .1
        second = tracker.update([(points, scores)], 1, 30, 1000)[0]
        self.assertTrue(second['review'])
        self.assertEqual(first['points'][9], second['points'][9])
        third = tracker.update([(points, scores)], 8, 30, 1000)[0]
        self.assertEqual(third['points'][9], points[9])

    def test_scene_cut_starts_new_identities(self):
        tracker = ActorTracker()
        tracker.update([candidate(100)], 0, 30, 1000)
        tracker.reset()
        self.assertEqual(tracker.update([candidate(100)], 1, 30, 1000)[0]['id'], 2)
