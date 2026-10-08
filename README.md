# RAVE

Watch-together MVP: upload a video to Supabase Storage, create a room URL, and synchronize playback with Supabase Realtime Broadcast. Each browser streams the video directly.

Supabase is configured for the public `videos` bucket. The browser uses only a publishable key; never use a service_role key here.