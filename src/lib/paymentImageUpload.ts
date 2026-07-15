import { supabase } from "@/integrations/supabase/client";

const PAYMENT_IMAGES_BUCKET = "payment-images";
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const MIME_EXT_FALLBACK: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

const EXT_MIME_FALLBACK: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

type ToastFn = (props: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type UploadPaymentImageOptions = {
  file: File;
  baseName: string;
  toast: ToastFn;
};

function getSafeExtension(file: File): string {
  const rawExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const cleaned = (rawExt || "").trim().toLowerCase();
  const isValid = cleaned.length > 0 && cleaned.length <= 5 && /^[a-z0-9]+$/.test(cleaned);
  return isValid ? cleaned : MIME_EXT_FALLBACK[file.type] || "png";
}

function getUploadableFile(file: File): File {
  if (file.type) return file;
  const ext = getSafeExtension(file);
  const fallbackType = EXT_MIME_FALLBACK[ext] || "image/png";
  return new File([file], file.name || `image.${ext}`, { type: fallbackType, lastModified: file.lastModified });
}

function getRandomSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePathPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "image";
}

function getErrorDetails(error: unknown) {
  const record = error as Record<string, unknown>;
  return {
    name: record?.name,
    message: record?.message,
    status: record?.status,
    statusCode: record?.statusCode,
    code: record?.code,
    details: record?.details,
    hint: record?.hint,
    raw: error,
  };
}

function buildUploadErrorMessage(error: unknown) {
  const details = getErrorDetails(error);
  const status = details.status ? `HTTP ${details.status}` : null;
  const statusCode = details.statusCode ? `código ${details.statusCode}` : null;
  const prefix = [status, statusCode].filter(Boolean).join(" / ");
  return `${prefix ? `${prefix}: ` : ""}${details.message || "Falha ao enviar imagem"}`;
}

async function getFreshUploadSession() {
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;

  let session = current.data.session;
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = session?.expires_at ? session.expires_at - now : null;

  if (!session || (secondsUntilExpiry !== null && secondsUntilExpiry < 60)) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    session = refreshed.data.session;
  }

  if (!session?.user?.id) {
    throw new Error("Sessão expirada. Entra novamente e tenta subir a imagem outra vez.");
  }

  return session;
}

export async function uploadPaymentImage({ file, baseName, toast }: UploadPaymentImageOptions): Promise<string | null> {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    toast({
      title: "Imagem muito grande",
      description: `O arquivo tem ${(file.size / (1024 * 1024)).toFixed(2)} MB. O tamanho máximo é 2MB — escolha uma imagem menor ou comprima antes de enviar.`,
      variant: "destructive",
    });
    return null;
  }

  let session;
  try {
    session = await getFreshUploadSession();
  } catch (error) {
    console.error("[payment-images] Upload blocked by missing/expired session", getErrorDetails(error));
    toast({
      title: "Sessão expirada",
      description: "Entra novamente e tenta subir a imagem outra vez.",
      variant: "destructive",
    });
    return null;
  }

  const uploadableFile = getUploadableFile(file);
  const extension = getSafeExtension(uploadableFile);
  const contentType = uploadableFile.type || EXT_MIME_FALLBACK[extension] || "image/png";
  const safeBaseName = sanitizePathPart(baseName);
  const path = `${session.user.id}/${safeBaseName}-${Date.now()}-${getRandomSuffix()}.${extension}`;

  const { error } = await supabase.storage.from(PAYMENT_IMAGES_BUCKET).upload(path, uploadableFile, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

  if (error) {
    const secondsUntilExpiry = session.expires_at ? session.expires_at - Math.floor(Date.now() / 1000) : null;
    console.error("[payment-images] Upload failed", {
      bucket: PAYMENT_IMAGES_BUCKET,
      path,
      file: {
        name: file.name,
        size: file.size,
        originalType: file.type || null,
        uploadType: contentType,
        lastModified: file.lastModified,
      },
      session: {
        userId: session.user.id,
        expiresAt: session.expires_at,
        secondsUntilExpiry,
      },
      error: getErrorDetails(error),
    });
    toast({
      title: "Erro ao enviar imagem",
      description: buildUploadErrorMessage(error),
      variant: "destructive",
    });
    return null;
  }

  const { data } = supabase.storage.from(PAYMENT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}