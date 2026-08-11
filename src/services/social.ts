/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

export const socialService = {
  async getConnectedAccounts() {
    const { data, error } = await supabase
      .from("social_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async disconnectAccount(id: string) {
    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
};

export type SocialAccount = any;
