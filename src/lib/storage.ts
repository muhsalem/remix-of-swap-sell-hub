import { supabase } from "@/integrations/supabase/client";

export async function uploadListingImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("listing-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getImageUrl(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("listing-images").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? "";
}

export async function uploadDisputeAttachment(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("dispute-attachments").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getDisputeAttachmentUrl(path: string): Promise<string> {
  if (!path) return "";
  const { data } = await supabase.storage.from("dispute-attachments").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

