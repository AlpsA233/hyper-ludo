import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// 生成8位随机配置ID
function generateConfigId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

    // 生成唯一ID
    let configId = generateConfigId();
    let exists = await kv.exists(`config:${configId}`);

    // 确保ID不重复
    while (exists) {
      configId = generateConfigId();
      exists = await kv.exists(`config:${configId}`);
    }

    // 创建配置对象
    const config = {
      id: configId,
      cards,
      events,
      createdAt: new Date().toISOString(),
    };

    // 存储到 Vercel KV，30天后过期
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
