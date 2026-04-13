# Evidence Artifacts

Operational evidence generated during EC2 cutover and verification.

## Location Convention
- Cutover evidence bundle:
  - `docs/evidence/cutover/<timestamp>/`
- Primary summary file:
  - `docs/evidence/cutover/<timestamp>/summary.txt`
- Final verification bundle:
  - `docs/evidence/final-verification/<timestamp>/summary.txt`
  - `docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`

## Generator
```bash
bash scripts/capture-cutover-evidence.sh
npm run ops:evidence:report
npm run ops:closure:preflight
npm run ops:closure:selftest
npm run ops:verify3
npm run ops:verify3:report
npm run ops:verify3:apply
npm run ops:verify3:check
# or
npm run ops:closure
# default verification runs 1 round.
# optional strict mode:
ROUNDS=3 npm run ops:verify3
ROUNDS=3 npm run ops:closure
```

## Report Output
- `REPORT.md` is generated per bundle and contains:
  - parsed command outcomes
  - failure count
  - patch-note snippet template
- `FINAL_REPORT.md` is generated per final verification run and contains:
  - closure state (PASS/FAIL)
  - per-round status
  - final patch-note snippet template
