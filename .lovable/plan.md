# Campaign Processing Synchronization UI Fix

Address the issue where the campaign processing UI stays stuck in "NA FILA" (Queued) even after the server-side worker has completed the render job.

## Proposed Changes

### 1. Enhanced Synchronization in `campanha.tsx`
- **Realtime Subscription Fix**: Ensure the Supabase Realtime subscription correctly updates the local state for *all* relevant status transitions (queued -> processing -> ready/failed).
- **Polling Fallback**: Implement a smart polling mechanism that activates when there are renders in "queued" or "processing" states, ensuring UI updates even if Realtime events are missed.
- **Refresh Recovery**: Ensure `fetchData` correctly hydrates the UI state from existing `media_renders` records in the database, so page refreshes correctly show "ready" status.

### 2. UI/UX Improvements in Processing Step
- **Visual Progress States**:
  - `queued`: 10% progress, pulse animation, "Na fila..." text.
  - `processing`: Indeterminate animated progress bar, "Processando vídeo..." text.
  - `ready`: 100% progress, green check, "Concluído" text.
  - `failed`: Red error state with "Falha no processamento".
- **Dynamic Preview**: Automatically generate Signed URLs for previews as soon as a render becomes "ready".
- **Activation Gate**: Ensure the "Continuar" button is strictly gated by all selected videos being in `ready` status with a valid `storage_path`.

### 3. Dashboard Cleanup
- Restore `src/routes/index.tsx` to its intended state as a functional dashboard, removing the temporary "HOTFIX P0" debug text.

## Technical Details
- **Source of Truth**: The `media_renders` table is the definitive source of truth for processing status.
- **Polling Interval**: 3 seconds while active renders are pending.
- **Realtime Channel**: `media_renders_changes` scoped to the current user's renders.
- **Signed URLs**: Generated using `supabase.storage.from("rendered").createSignedUrl(path, 3600)`.

## Verification Plan
1. **Manual Test**: Start a campaign, click "Processar tudo".
2. **Observation**: Verify the card updates to "Na fila", then "Processando" (if worker picks it up), then "Concluído".
3. **Recovery Test**: Refresh the page during/after processing; verify state persistence.
4. **Gate Test**: Verify "Continuar" is disabled until all renders are "ready".
