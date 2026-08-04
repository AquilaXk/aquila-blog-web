# Web release

Use the promoted home-server deployment, not a preview deployment, as the release target.

1. Record the merged Web commit, immutable image digest/build SHA, and deployment workflow run URL/ID.
2. Verify the ready anonymous gate at `https://blog.aquilaxk.site` without credentials: the public shell responds successfully and uses the same-origin API path contract.
3. Verify the promoted auth gate with an authorized test account: sign-in, authenticated page navigation, and sign-out complete against the promoted deployment.
4. Record the Platform release-state snapshot (`front_active`, active/previous image, active/previous build SHA, `front_switched_at`, result/reason), edge verification time, and both gate results in the release evidence.

Do not mark a release complete from workflow status alone. The edge response, workflow run ID, immutable digest/build SHA, and Platform release-state evidence are all required. Missing evidence fails closed; do not infer a replacement from a mutable tag.
