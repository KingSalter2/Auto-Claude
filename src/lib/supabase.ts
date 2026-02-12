import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://mlbbtstupewssvkczjew.supabase.co";
export const supabaseAnonKey = "sb_publishable_on-ah-ZUJm9PjzulVT_djw_yqY637xu";
export const supabaseBucket = "vehicle-images";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

