import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://blrkunsmcnvdwqrarpco.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscmt1bnNtY252ZHdxcmFycGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzY2MTAsImV4cCI6MjA4MzQ1MjYxMH0.ZqcNCg2S4iYDIPXWl5YkD2BPbGniGyPB1Tp0nB5SpkI';

export const supabase = createClient(supabaseUrl, supabaseKey);
