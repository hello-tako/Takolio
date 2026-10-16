# Tako 3D candidate authoring source

The operator accepted the first genuine Blender candidate for continued implementation on 2026-10-16 JST, then authorized refinement of both the mascot and app UI. This is provisional visual acceptance, not premium-production, 100% concept-fidelity, trademark or release approval.

Six 2048px RGBA PNG masters are pinned by `render-manifest.json`. `build_tako.py` constructs the real eight-arm mesh, materials and 33-bone starter rig in Blender 4.5.9 LTS. `render_pose_set.py` creates static purpose-specific expressions and compositions using multi-segment rotations, IK targets and bone-parented props. `render_views.py` creates front/three-quarter/side/back proof. Boards were inspected for style only; no pixels were cropped, traced or extracted as textures. No external textures or installed fonts are used.

## Rebuild

Keep native outputs in a local scratch directory outside the public repo. Set `TAKO_BUILD_OUT` to that absolute directory when running Blender with `--background --python-exit-code 1 --python build_tako.py`. Then set `TAKO_POSE_OUT` to the scratch directory and `TAKO_MASTER` to its generated `.blend` when running `render_pose_set.py` with the same Blender flags. Default export settings are Cycles, 2048px, 64 samples and seed 17; `TAKO_RENDER_SIZE`, `TAKO_SAMPLES` and `TAKO_POSES` support explicit preview runs. The filename suffix remains `2048` during trial runs, so verify decoded dimensions before pinning any master. The turnaround script expects the native master beside itself; use a scratch source copy for turnaround exports.

The native `.blend` and high-detail `.glb` are local handoff deliverables, identified by SHA in the manifest. They contain the editable starter model/rig, not six certified animation clips. They are excluded from the public repository and browser runtime. Blender pixels can vary across devices/versions. Review and explicitly pin new render masters; CI does not invoke Blender.

`pnpm brand:icons` uses only pinned PNG/SVG/font masters and local Sharp 0.35.5. It verifies each PNG SHA and creates 256/512/1024px WebP illustrations. Same-toolchain double-generation and committed hashes are tested separately from the historical native SVG raster rounding allowance. The vector mascot fallback and old Takosan assets remain available. The existing service-worker release build ID controls cache updates.

## Refinements And Limits

The six states change silhouette and purpose: welcome wave/heart; cooking bowl/spoon; thinking hand at cheek; excited raised arms/hearts; completed supported bowl/stars; cheering raised arms/confetti. The hat is smoother and more matte, skin highlights softer, eye catchlights simpler, and sucker placement follows arc length and local surface direction. Prop helpers preserve evaluated scale and use actual object references to avoid pose-name collisions. Contact distances in the manifest are smoke checks against nearest prop vertices; actual-size visual review is still required.

These are static candidate illustrations. Full facial controls, production deformation/weights, natural encircling grip polish, optimization, concept fidelity finishing and physical-device acceptance remain open. The app keeps the kit's vector micro icon for small controls. Do not call this a pixel-perfect reproduction of the concept board or a premium-approved mascot.

Rights provenance: original procedural geometry created for the operator's authorized Takolio migration from the supplied kit. The kit supplies no standalone asset license and this does not assert exclusive ownership or trademark clearance. No third-party texture/model/paid font is included. Blender itself is an external authoring tool and is not redistributed here.
