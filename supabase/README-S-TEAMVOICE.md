# S-TeamVoice Pro secure integration

The authenticated Gemini proxy is in:
supabase/functions/gemini-proxy/index.ts

## Required Supabase secret
In Supabase Dashboard, open Project Settings -> Edge Functions -> Secrets and add:
- Name: GEMINI_API_KEY
- Value: your Google AI Studio Gemini API key

Never commit the Gemini key to this repository or place it in browser code.

## Deploy the Edge Function
Deploy the function named gemini-proxy from this repository using the Supabase CLI:

```bash
supabase login
supabase link --project-ref ovqhioywonnaglctwvne
supabase functions deploy gemini-proxy
```

The function validates the caller's Supabase access token and checks that the matching profiles row has is_active=true before forwarding an allowlisted Gemini model request.

IMPORTANT: The S-TeamVoice React frontend has not yet been switched to this proxy. Do not consider the app integration complete until its three Gemini calls (Ads copy, single-speaker TTS, and dialogue TTS) have been changed to call this Edge Function with the user's Bearer access token.
