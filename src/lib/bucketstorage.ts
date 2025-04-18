import { createClient } from "@supabase/supabase-js";
import { Image } from "imagescript";

export async function uploadImageToBucket(
  base64String: string,
  fileName: string,
  kind:string,
  bucketName = process.env.BUCKET_NAME!
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const fileBuffer = Buffer.from(base64String, "base64");
    const image = await Image.decode(fileBuffer);
    const webp = await image.encodeWEBP(80);

    const baseName = fileName.split(".")[0] || "poster";
    const uniqueFileName = `${kind}/${Date.now()}_${baseName}.webp`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueFileName, new Blob([webp]), {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: true,
      });

    if (error || !data) {
      console.error("Supabase Upload Error:", error);
      throw new Error(`File upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Image upload error:", err);
    throw new Error("Image processing/upload failed");
  }
}
