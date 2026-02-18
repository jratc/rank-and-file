-- Enable realtime for list_items
BEGIN;
  -- Check if publication exists (it usually does in Supabase)
  -- We want to add list_items to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
COMMIT;
