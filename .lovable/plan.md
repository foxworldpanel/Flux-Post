I will implement the "Campanha Ativa" page at /campanha with the following steps:

1. **Route Configuration**: Update `src/App.tsx` and `src/components/DashboardLayout.tsx` to include the `/campanha` route and sidebar link.
2. **Page Implementation (`src/routes/campanha.tsx`)**:
    - Fetch active campaign from `campanhas` table (where status is 'ativo').
    - If no active campaign:
        - Fetch music tracks from `music_tracks`.
        - Render a creation form with all requested fields (name, music, posts per day, start/end times, intervals, start/end dates).
        - Submit handler: Save to `campanhas`, update `music_tracks` set `campanha_ativa = true`.
    - If active campaign exists:
        - Fetch associated music track details.
        - Calculate remaining days and progress percentage.
        - Count total posts realized (from `posts_agendados`).
        - Render the active campaign dashboard with stats and action buttons (Pause/End).
3. **Styling**: Ensure it follows the dark theme (#0A0A0F background, #13131F cards, #7C3AED purple).

**Technical details:**
- Using `supabase-js` for database operations.
- `posts_por_dia` limited to 3 as requested.
- `data_fim` defaults to 30 days from today.
- `intervalo_min` defaults to 40 mins, `intervalo_max` to 90 mins.
- `status` field in `campanhas` will be used to track state ('ativo', 'pausado', 'encerrado').
