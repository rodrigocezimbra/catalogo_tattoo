import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

const supabaseUrl = 'https://pvjcpgvkmolgtvdaqlzi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amNwZ3ZrbW9sZ3R2ZGFxbHppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM5NTg3OTYsImV4cCI6MjA0OTUzNDc5Nn0.Au_fbs9pbWbVCfG2vDN2RI3C_jD3DJNXTr11bgqFQ3s';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
