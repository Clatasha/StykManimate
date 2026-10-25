"""Small bounded 2D actor tracker. No ML or video dependencies at import time."""
import itertools
import math


class ActorTracker:
    """Match predicted pelvis positions globally; uncertain matches need review.

    This is a prototype tracker, not identity recognition. Crossings/occlusion
    can still swap actors. Tracks expire rather than drawing frozen people.
    """
    def __init__(self, max_people=2, smoothing=0.2):
        self.max_people = max_people
        self.smoothing = smoothing
        self.tracks = {}
        self.next_id = 1

    def reset(self):
        self.tracks.clear()

    def update(self, candidates, tick, fps, diagonal):
        self.tracks = {uid: t for uid, t in self.tracks.items()
                       if tick - t['tick'] <= max(1, round(fps * .4))}
        candidates = candidates[:self.max_people]
        tracks = list(self.tracks.items())
        centers = [((p[11][0] + p[12][0]) / 2, (p[11][1] + p[12][1]) / 2)
                   for p, _ in candidates]
        costs = []
        for _, track in tracks:
            dt = tick - track['tick']
            prediction = [track['center'][i] + track['velocity'][i] * dt for i in (0, 1)]
            costs.append([math.dist(prediction, c) / max(diagonal, 1) for c in centers])
        # At most 4 actors: exhaustive partial assignment is inexpensive and
        # avoids greedy assignment stealing another actor's strongest match.
        best, assignment = float('inf'), ()
        for n in range(min(len(tracks), len(candidates)) + 1):
            for rows in itertools.combinations(range(len(tracks)), n):
                for columns in itertools.permutations(range(len(candidates)), n):
                    pairs = tuple(zip(rows, columns))
                    if any(costs[r][c] > .15 for r, c in pairs):
                        continue
                    cost = sum(costs[r][c] for r, c in pairs) + .16 * (len(candidates) - n)
                    if cost < best:
                        best, assignment = cost, pairs
        matched = {c: tracks[r][0] for r, c in assignment}
        output = []
        for c, (points, scores) in enumerate(candidates):
            uid = matched.get(c)
            uncertain = min(scores[5:17]) < .35
            if uid is None:
                uid = self.next_id
                self.next_id += 1
            previous = self.tracks.get(uid)
            points = [list(p) for p in points]
            velocity = (0, 0)
            if previous:
                dt = max(1, tick - previous['tick'])
                velocity = tuple((centers[c][i] - previous['center'][i]) / dt for i in (0, 1))
                for j in range(17):
                    if scores[j] < .35:
                        # Never hold a hidden joint indefinitely.
                        if tick - previous['seen'][j] <= fps * .2:
                            points[j] = previous['points'][j][:]
                    else:
                        points[j] = [points[j][i] * (1 - self.smoothing) +
                                     previous['points'][j][i] * self.smoothing for i in (0, 1)]
                # Nearby competing assignments are explicitly marked uncertain.
                row = next((r for r, col in assignment if col == c), None)
                if row is not None:
                    alternatives = sorted(costs[row])
                    uncertain |= len(alternatives) > 1 and alternatives[1] - alternatives[0] < .035
            seen = [tick if score >= .35 else (previous['seen'][j] if previous else -10000)
                    for j, score in enumerate(scores)]
            self.tracks[uid] = dict(points=points, center=centers[c], velocity=velocity, tick=tick, seen=seen)
            output.append(dict(id=uid, points=points, review=bool(uncertain)))
        return output
