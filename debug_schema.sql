-- Check columns in profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles';

-- Check triggers on auth.users
SELECT event_object_schema, event_object_table, trigger_name, action_statement, action_orientation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users' AND event_object_schema = 'auth';

-- Check triggers on public.profiles
SELECT event_object_schema, event_object_table, trigger_name, action_statement, action_orientation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles' AND event_object_schema = 'public';
