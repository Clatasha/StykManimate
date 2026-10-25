"""Optional local video inference. Frames stream to the editor; video stays local."""
import importlib.util
import math
import os
from pathlib import Path
import sys
import time

from motion_tracking import ActorTracker
from work_control import checkpoint


def status():
    # Readiness must not import native inference libraries. Loading their DLLs
    # can be slow on a cold Windows start; doing it here blocked the importer
    # before the user could even start a capture. Actual device verification
    # belongs to create_models(), after progress/cancellation are available.
    missing = []
    for name in ('cv2', 'rtmlib', 'onnxruntime'):
        try:
            if importlib.util.find_spec(name) is None:
                missing.append(name)
        except (ImportError, ValueError):
            missing.append(name)
    if missing:
        return dict(available=False, providers=[], missing=missing,
                    message='Motion capture needs the optional motion runtime. Use the StykManimate Windows preview or see docs/MOTION-CAPTURE.md.')
    ort = sys.modules.get('onnxruntime')
    providers = ort.get_available_providers() if hasattr(ort, 'get_available_providers') else []
    return dict(available=True, providers=providers,
                message='Motion runtime is ready. Your selected processor will be checked when conversion starts.')


def model_directory():
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1] / 'build')) / 'motion-models'


def create_models(mode, device):
    import onnxruntime as ort
    from rtmlib import Body, YOLOX, RTMPose
    from rtmlib.tools.base import BaseTool
    from rtmlib.tools.file import download_checkpoint

    providers = ort.get_available_providers()
    gpu = next((p for p in ('CUDAExecutionProvider', 'DmlExecutionProvider') if p in providers), None)
    if device == 'gpu' and not gpu:
        raise RuntimeError('GPU mode is unavailable. This preview needs DirectML on Windows or ONNX Runtime CUDA. Choose CPU to test explicitly.')
    chosen = gpu if device != 'cpu' and gpu else 'CPUExecutionProvider'

    # Insert a session-owning base into RTMLib's MRO: its tested constructors,
    # preprocessing, decoding and inference stay intact. DirectML requires
    # sequential execution and disabled memory patterns, unlike the stock base.
    class LocalSession(BaseTool):
        def __init__(self, onnx_model, model_input_size=None, mean=None, std=None,
                     backend='onnxruntime', device='cpu'):
            checkpoint()
            options = ort.SessionOptions()
            options.intra_op_num_threads = min(4, os.cpu_count() or 1)
            if chosen == 'DmlExecutionProvider':
                options.enable_mem_pattern = False
                options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            self.session = ort.InferenceSession(str(onnx_model), sess_options=options, providers=[chosen])
            if self.session.get_providers()[0] != chosen:
                raise RuntimeError(f'{chosen} failed to initialise; refusing to silently benchmark CPU as GPU.')
            self.onnx_model, self.model_input_size = onnx_model, model_input_size
            self.mean, self.std = mean, std
            self.backend, self.device = 'onnxruntime', device

    class Detector(YOLOX, LocalSession):
        pass

    class Pose(RTMPose, LocalSession):
        pass

    config = Body.MODE[mode]
    paths = {}
    for kind in ('det', 'pose'):
        checkpoint()
        bundled = model_directory() / f'{mode}-{kind}.onnx'
        paths[kind] = str(bundled) if bundled.is_file() else download_checkpoint(config[kind])
    detector = Detector(paths['det'], model_input_size=config['det_input_size'])
    pose = Pose(paths['pose'], model_input_size=config['pose_input_size'], to_openpose=False)
    return detector, pose, chosen


def number(query, key, default, low, high):
    value = float(query.get(key, [default])[0])
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{key} must be between {low} and {high}.')
    return value


def capture(path, query, emit):
    started = time.perf_counter()
    checkpoint()
    emit(dict(type='stage', message='Starting motion runtime. First use can take longer while the local libraries load.'))
    import cv2
    import numpy as np

    mode = query.get('mode', ['lightweight'])[0]
    device = query.get('device', ['gpu'])[0]
    if mode not in ('lightweight', 'balanced') or device not in ('gpu', 'cpu'):
        raise ValueError('Invalid capture quality or device.')
    target_fps = number(query, 'fps', 30, 1, 60)
    start = number(query, 'start', 0, 0, 86400)
    duration = number(query, 'duration', 10, .1, 600)
    people = int(number(query, 'people', 2, 1, 4))
    smoothing = number(query, 'smoothing', .2, 0, .8)
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise ValueError('This video could not be decoded. Try an MP4 with H.264 video.')
        source_fps = cap.get(cv2.CAP_PROP_FPS)
        source_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if not math.isfinite(source_fps) or not 1 <= source_fps <= 240 or min(width, height) < 1 or width * height > 3840 * 2160:
            raise ValueError('Use a video up to 4K with a valid frame rate between 1 and 240 FPS.')
        if not math.isfinite(source_count) or source_count <= 0 or start >= source_count / source_fps:
            raise ValueError('The start time is beyond the video duration or the duration is unknown.')
        fps = min(target_fps, source_fps)
        duration = min(duration, source_count / source_fps - start)
        total = math.ceil(duration * fps - 1e-8)
        if total > 18000:
            raise ValueError('Choose a shorter section or lower capture FPS (maximum 18000 output frames).')
        emit(dict(type='stage', message='Loading motion models. First use may download model weights; later runs reuse them.'))
        detector, pose, provider = create_models(mode, device)
        checkpoint()
        model_seconds = time.perf_counter() - started
        emit(dict(type='header', width=width, height=height, fps=fps, total=total, provider=provider,
                  modelSeconds=model_seconds, sourceStart=start, mode=mode))
        tracker = ActorTracker(people, smoothing)
        first_source = int(round(start * source_fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, first_source)
        current = first_source - 1
        analysis_started = time.perf_counter()
        previous_thumb = None
        frames = reviews = cuts = 0
        for tick in range(total):
            checkpoint()
            wanted = first_source + int(math.floor(tick * source_fps / fps + 1e-8))
            ok = True
            # Sequential decoding: no repeated random video seeks.
            while current < wanted:
                checkpoint()
                ok = cap.grab()
                current += 1
                if not ok:
                    break
            if not ok:
                break
            ok, image = cap.retrieve()
            if not ok:
                break
            # Detect hard cuts conservatively. Identities restart rather than
            # joining unrelated shots; fast motion can still trigger a review.
            thumb = cv2.resize(image, (32, 18)).astype(np.float32) / 255
            cut = previous_thumb is not None and float(np.mean(np.abs(thumb - previous_thumb))) > .32
            previous_thumb = thumb
            if cut:
                tracker.reset()
                cuts += 1
            scale = min(1., 960 / max(width, height))
            small = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale)))) if scale < 1 else image
            boxes = detector(small)
            boxes = sorted(boxes, key=lambda b: max(0, b[2]-b[0]) * max(0, b[3]-b[1]), reverse=True)[:people]
            candidates = []
            if len(boxes):
                points, scores = pose(small, bboxes=boxes)
                for p, s in zip(points, scores):
                    p, s = p[:17], s[:17]
                    if len(p) == 17 and np.isfinite(p).all() and np.isfinite(s).all() and min(s[5], s[6], s[11], s[12]) >= .25:
                        candidates.append(((p / scale).tolist(), s.tolist()))
            actors = tracker.update(candidates, tick, fps, math.hypot(width, height))
            if tracker.next_id > 129:
                raise ValueError('Too many lost tracks or scene cuts. Convert a shorter section.')
            review = bool(cut or not actors or any(a['review'] for a in actors))
            frames += 1
            reviews += int(review)
            elapsed = time.perf_counter() - analysis_started
            emit(dict(type='frame', tick=tick, actors=actors, review=review,
                      progress=dict(frames=frames, total=total, elapsed=elapsed,
                                    processingFPS=frames / max(elapsed, .001),
                                    remaining=(total-frames) * elapsed / frames)))
        if frames == 0:
            raise ValueError('No frames could be decoded from this section.')
        elapsed = time.perf_counter() - analysis_started
        emit(dict(type='done', frames=frames, reviewFrames=reviews, cuts=cuts,
                  analysisSeconds=elapsed, modelSeconds=model_seconds,
                  totalSeconds=time.perf_counter()-started, processingFPS=frames/max(elapsed, .001),
                  provider=provider, truncated=frames < total))
    finally:
        cap.release()
