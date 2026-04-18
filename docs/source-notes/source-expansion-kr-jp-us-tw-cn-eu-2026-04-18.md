# Source Expansion Verification (2026-04-18)

## Scope
- Plan: `KR/JP/US` expansion + `TW/CN/EU` complement
- Total target sources: `14`
- Runtime policy: no login/proxy/captcha bypass, free-access endpoints only

## Batch Assignment
- Batch A: `tieba`, `gutefrage`, `yahoo_japan`, `togetter`, `slashdot`
- Batch B: `inven`, `instiz`, `arca`, `bahamut`, `mobile01`
- Batch C: `girlschannel`, `mumsnet`, `fark`, `resetera`

## Scraper Test Result
| Source | Batch | Region | Result | Post Count | Notes |
|---|---|---|---|---:|---|
| tieba | A | cn | connected | 29 | `topicList` HTML parse |
| gutefrage | A | eu | connected | 16 | homepage listing parse |
| yahoo_japan | A | jp | connected | 50 | multi-feed RSS aggregate |
| togetter | A | jp | connected | 50 | homepage card parse |
| slashdot | A | us | connected | 15 | RSS parse |
| inven | B | kr | connected | 21 | webzine news parse |
| instiz | B | kr | connected | 41 | PT board parse |
| arca | B | kr | degraded | 1 | direct blocked/challenge, Google News fallback only |
| bahamut | B | tw | degraded | 8 | direct GNN links available but volume limited |
| mobile01 | B | tw | connected | 30 | direct blocked, Google News fallback stable |
| girlschannel | C | jp | connected | 50 | `/new/` list parse |
| mumsnet | C | eu | connected | 27 | talk RSS parse |
| fark | C | us | connected | 50 | RSS parse |
| resetera | C | us | connected | 39 | forum RSS parse |

## Batch Collect Result
- `npm run collect -- --source tieba,gutefrage,yahoo_japan,togetter,slashdot` -> `5/5 succeeded`
- `npm run collect -- --source inven,instiz,arca,bahamut,mobile01` -> `5/5 succeeded`
- `npm run collect -- --source girlschannel,mumsnet,fark,resetera` -> `4/4 succeeded`

## Runtime Constraint (Local)
- `persistScraperResult` warnings observed for all batch runs:
  - `PostgreSQL configuration unavailable. Skipping persistence.`
- This local session validated scraper connectivity and parsing only.
- DB-ingest and source report generation must be rerun on EC2 runtime env (`/etc/global-pulse/global-pulse.env` loaded).

## Immediate Follow-up
1. EC2 runtime: run `seed:regions`, then Batch A/B/C collect once each.
2. Generate source report in runtime env:
   - `npm run ops:source:report -- --minutes 180 --print-json`
3. If `arca` remains `<5` and `bahamut` remains `<10` for 24h, move to temporary disable list and keep root-cause note.
