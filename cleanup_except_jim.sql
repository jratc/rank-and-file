-- Database Cleanup Script
-- This script will remove all lists, list items, comments, and feedback 
-- except those created by 'Jim'. 
-- It keeps all user accounts and profiles intact.

DO $$
DECLARE
    jim_user_id UUID;
BEGIN
    -- Find Jim's user_id from the profiles table
    SELECT id INTO jim_user_id
    FROM public.profiles
    WHERE display_name = 'Jim' OR username = 'Jim'
    LIMIT 1;

    IF jim_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not find a user named Jim. Aborting cleanup.';
    END IF;

    -- Delete all comments not authored by Jim
    DELETE FROM public.comments
    WHERE user_id != jim_user_id;

    -- Delete all list_items that belong to lists NOT owned by Jim
    DELETE FROM public.list_items
    WHERE list_id IN (
        SELECT id FROM public.lists WHERE user_id != jim_user_id
    );

    -- Delete all lists not owned by Jim (Responses are stored here too, so this cleans them up)
    DELETE FROM public.lists
    WHERE user_id != jim_user_id;

    -- Delete feedback where user is not Jim
    DELETE FROM public.feedback
    WHERE user_id != jim_user_id;

    RAISE NOTICE 'Cleanup complete. Retained all data for user %', jim_user_id;
END $$;
