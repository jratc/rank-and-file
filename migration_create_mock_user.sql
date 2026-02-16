-- Create a mock user profile for development with auth bypass
-- This allows testing without real authentication

-- Insert mock user profile (matches the ID in lib/auth-bypass.ts)
INSERT INTO public.profiles (id, username, display_name)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'mockuser',
  'Mock User (Dev Mode)'
)
ON CONFLICT (id) DO NOTHING;

SELECT 'Mock user profile created for development!' AS status;
