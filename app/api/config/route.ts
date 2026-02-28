import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createHash } from "crypto";

// 根据配置内容生成固定ID（相同配置生成相同ID）
function generateConfigId(config: any): string {
  const content = JSON.stringify(config);
  const hash = createHash("sha256").update(content).digest("hex");
  // 取前8位作为ID
  return hash.substring(0, 8);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cards, events } = body;

    if (!cards || !events) {
      return NextResponse.json(
        { error: "缺少卡牌或事件配置" },
        { status: 400 },
      );
    }

    // 创建配置对象（不包含时间戳，确保相同内容生成相同ID）
    const configContent = { cards, events };

    // 根据内容生成ID
    const configId = generateConfigId(configContent);

    // 创建完整配置（包含ID和时间戳）
    const config = {
      id: configId,
      cards,
      events,
      createdAt: new Date().toISOString(),
    };

    // 存储到 Vercel KV，30天后过期（相同配置会刷新过期时间）
    await kv.set(`config:${configId}`, JSON.stringify(config), {
      ex: 60 * 60 * 24 * 30, // 30天
    });

    return NextResponse.json({
      success: true,
      id: configId,
      message: `配置已保存: ${configId}`,
    });
  } catch (error) {
    console.error("Config save error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "配置保存失败",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const configId = request.nextUrl.searchParams.get("id");

    if (!configId) {
      return NextResponse.json({ error: "缺少配置ID" }, { status: 400 });
    }

    // 从 Vercel KV 读取配置
    const configStr = await kv.get<string>(`config:${configId}`);

    if (!configStr) {
      return NextResponse.json(
        { error: "配置不存在或已过期" },
        { status: 404 },
      );
    }

    const config = JSON.parse(configStr);
    return NextResponse.json(config);
  } catch (error) {
    console.error("Config load error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "配置加载失败",
      },
      { status: 500 },
    );
  }
}
