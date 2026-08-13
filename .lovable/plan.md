# Plan: Phase 4.5 — Visibility and Preview of Renders in Campaigns

Enable user visibility and control over the rendering pipeline within the campaign details view.

## User Review Required

> [!IMPORTANT]
> This phase focuses on UI/UX for existing backend data. No changes will be made to the rendering engine or bridge architecture.

- **Realtime Updates**: I will implement Supabase Realtime to update render statuses automatically without page refreshes.
- **Signed URLs**: Final videos will be served via temporary signed URLs from the private `rendered` bucket.

## Proposed Changes

### 1. Database & Schema Audit (Verification)
- Table: `media_renders` (confirmed: `source_content_id`, `render_key`, `status`, `storage_path`, `error_message`, etc.)
- Statuses: `queued`, `processing`, `ready`, `failed` (from `render_status` enum).
- Bucket: `rendered`.

### 2. Campaign UI Enhancements (`src/routes/campanha.tsx`)
- **Render Summary Header**: Add a card at the top of the campaign view showing aggregate stats (Total, Queued, Processing, Ready, Failed).
- **Publication List Integration**:
  - Map each publication/content item to its corresponding `media_renders` record using `render_key` (SHA-256 of video+audio+settings).
  - Display visual badges for each status.
  - Add "Ver vídeo final" button for `ready` status.
  - Add "Aprovar para publicação" and "Refazer renderização" buttons.

### 3. Final Video Preview
- Implement a modal/player that fetches a signed URL for the `output_storage_path` in the `rendered` bucket.
- Ensure only the *final* mixed video is shown, not the original source.

### 4. Realtime Synchronization
- Subscribe to `media_renders` changes filtered by the current campaign's relevant contents.
- Automatically update the UI state when a job moves from `processing` to `ready`.

### 5. Error Handling
- Show descriptive error messages from `media_renders.error_message` in a "Technical Details" tooltip or small alert within the item card.

## Technical Details

- **Data Fetching**: Use `useQuery` with initial fetch and manual cache updates via Realtime payload.
- **Signed URLs**: Use `supabase.storage.from('rendered').createSignedUrl(path, 3600)`.
- **Rerender Logic**: Implement a function to reset a render job by deleting the existing `media_renders` record (or updating it to `queued` if the `render_key` is to be reused).
- **Security**: All storage access remains private; URLs are short-lived.

## Success Criteria

- [ ] All renders for a campaign are visible with real-time status updates.
- [ ] User can play the final MP4 directly in the browser.
- [ ] Status summary matches the list items.
- [ ] No exposure of service role or private buckets.
