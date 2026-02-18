import { NextRequest, NextResponse } from "next/server";

const LSKY_PRO_API_BASE = "https://lk.aerbu2.top/api/v1";

interface LskyUploadResponse {
  status: boolean;
  message: string;
  data?: {
    key: string;
    name: string;
    pathname: string;
    origin_name: string;
    size: number;
    mimetype: string;
    extension: string;
    md5: string;
    sha1: string;
    links: {
      url: string;
      html: string;
      bbcode: string;
      markdown: string;
      markdown_with_link: string;
      thumbnail_url: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "只支持上传图片文件" },
        { status: 400 },
      );
    }

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "图片大小不能超过 10MB" },
        { status: 400 },
      );
    }

    // 准备上传数据
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    // 代理请求到 LskyPro
    const response = await fetch(`${LSKY_PRO_API_BASE}/upload`, {
      method: "POST",
      body: uploadFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `LskyPro 返回错误: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data: LskyUploadResponse = await response.json();

    if (data.status && data.data?.links?.url) {
      return NextResponse.json({
        success: true,
        url: data.data.links.url,
      });
    } else {
      return NextResponse.json(
        {
          error: data.message || "上传失败，请稍后重试",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "服务器上传失败",
      },
      { status: 500 },
    );
  }
}
