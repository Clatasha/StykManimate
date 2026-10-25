# StykManimate video motion capture preview

StykManimate is an experimental fork of [StykAnimate](https://github.com/filippocalippo/StykAnimate-App), retaining the original GPL-3.0-or-later license and attribution. It adds local video-to-stick-figure conversion. It is not an official StykAnimate release.

## Try it on Windows

The **StykManimate Windows Preview** Actions workflow builds a portable executable with Python, ONNX Runtime DirectML, RTMLib and the Fast/Balanced model weights included. No Python, CUDA toolkit, Node installation or model download is needed to run that build. Extract the downloaded artifact ZIP and run `StykManimate-Motion-Preview.exe`.

Open the application menu → **File → Import → Video to stick figures (Preview)**. Choose a video, leave the length at 10 seconds and the processor at **GPU (required)**, then select **Test 10 seconds**. Choose CPU test explicitly if you want a CPU comparison. DirectML uses a compatible Windows GPU through DirectX 12; GPU mode fails visibly if its session cannot initialise. It never intentionally substitutes a CPU-only session under a GPU label. Some unsupported model operators may still execute on CPU within a GPU session.

The status shows processing FPS, elapsed time and an estimated remaining time. Completed results separate model setup from analysis time and estimate analysis time for a similar two-minute clip at the chosen capture FPS. These estimates do not include upload, editor preparation or export. Source movement, number of people, settings and hardware affect results. No RTX 3060 performance is certified by a successful CI build.

Play or scrub the original video beside the generated stick figures. **Next uncertain frame** jumps between frames flagged for review. **Open editable animation** creates a new project tab without replacing your work. Save it as `.styk` to preserve capture metadata; the ordinary editor and export commands apply. The generated project starts unsaved.

## First-version scope

- Local files up to 256 MiB; video dimensions up to 4K, valid source FPS from 1 to 240.
- Choose a start time, section length up to 600 seconds, 1–4 people, 15/30/60 capture FPS, Fast/Balanced quality and smoothing. Output is limited to 18,000 frames; longer selections need a lower FPS or a shorter section.
- Capture FPS never exceeds source FPS. Frames are decoded sequentially and only selected frames are analysed; captured timing is retained.
- The detector takes the largest visible people, rather than letting you select a named actor. Simple motion tracking preserves IDs where possible. Hard cuts reset tracks; crossings and occlusion can still swap identities.
- Low-confidence or ambiguous frames are recorded in the project's `_styk.motionCapture.reviewFrames` metadata and counted in the preview. This is a review signal, not proof all other frames are correct.
- Screen-space movement is transferred, including position and projected limb lengths. This is 2D capture; it does not reconstruct unseen motion, separate camera movement, guarantee fixed anatomical bone lengths, track props or transfer audio.
- Video frames are streamed through a private temporary file; extracted poses are streamed to a worker. Cancelling discards the partial project and deletes temporary video when the running frame/model operation reaches its next cancellation checkpoint. Model loading and an individual native inference call are not interruptible midway.
- The static hosted browser editor does not include the Python motion runtime. Use the desktop preview or local development server.

## Develop from source

Use the repository's Node/Python versions and `npm ci`. In your chosen Python environment:

```sh
python -m pip install -r backend/requirements-fast.txt -r backend/requirements-motion.txt
python -m pip install rtmlib==0.0.16 --no-deps
python scripts/stage-motion-models.py
npm run serve
```

On Windows the pinned runtime uses DirectML without separate CUDA libraries. The non-Windows requirements use CPU ONNX Runtime. Advanced developers can install an appropriate CUDA runtime instead, but should not install multiple ONNX Runtime distributions into the same environment. The source server downloads missing model weights on first capture; staging them avoids that delay. Do not compare first-download time against steady-state inference.

Run focused checks:

```sh
node --test tests/motion-document.test.mjs
python -m unittest discover -s backend -p 'test_motion*.py' -v
python backend/server.py --motion-self-test
```

The self-test loads the real Fast models and runs detector/pose inference on CPU. It validates packaging and tensor shapes, not accuracy or GPU speed. The Windows workflow repeats it against the frozen runtime and the packaged files, and boots the packaged editor.

## Ownership and dependencies

`backend/motion_runtime.py` owns optional inference and streaming; `motion_tracking.py` owns short-lived actor tracking. The existing authenticated codec scheduler owns admission/cancellation. `src/motion-worker.mjs` parses the pose stream and uses `motion-document.mjs` to produce native editable segment records. Existing acknowledged document chunks bound transfer to the UI. `motion-dialog.mjs` owns preview media, progress and disposal. No separate animation renderer or saved format is introduced.

RTMLib is Apache-2.0; ONNX Runtime is MIT; OpenCV is Apache-2.0. Model weights come from the model URLs selected by RTMLib's `Body.MODE` (YOLOX HumanArt and RTMPose Body7). Check upstream notices/model and training-data terms before commercial redistribution. Source and bundled package notices remain included. See `THIRD_PARTY_NOTICES.md`.
