/**
 * LskyPro API 客户端（通过 Next.js 代理）
 * 用于图片上传到 Lsky Pro 服务
 */

export async function uploadImageToLskyPro(file: File): Promise<string> {
  // 验证文件类型
  if (!file.type.startsWith("image/")) {
    throw new Error("只支持上传图片文件");
  }

  // 验证文件大小（最大 10MB）
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("图片大小不能超过 10MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.url) {
      return data.url;
    } else {
      throw new Error(data.error || "上传失败，请稍后重试");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`图片上传失败: ${error.message}`);
    }
    throw new Error("图片上传失败: 网络错误");
  }
}
