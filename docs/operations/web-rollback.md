# Web rollback

Rollback applies to a failed promoted home-server deployment and to the controlled rollback drill required before source cutover.

1. Stop promotion and record the workflow run URL/ID, commit, immutable image digest/build SHA, and observed failure or drill reason.
2. Promote the exact previous image digest and build SHA recorded by the Platform-owned release state. Do not resolve `latest` or another mutable tag.
3. Repeat the ready anonymous gate at `https://blog.aquilaxk.site` and the promoted auth gate with an authorized test account.
4. Record the restored Platform release-state snapshot, image digest/build SHA, edge verification time, and both gate results before closing the incident.

Do not use a preview deployment as rollback evidence. If the recorded digest/build SHA is missing or cannot be promoted, leave the release failed and report the blocker; do not select a fallback deployment.
