import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const CONFIG_DIR = join(process.cwd(), "public", "configs");

// 生成8位随机中英文数字组合
function generateConfigId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789中英配置";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    // 确保配置目录存在
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true });
    }

    const body = await request.json();
    const { cards, events } = body;

    if (!cards || !events) {
      return NextResponse.json(
        { error: "缺少卡牌或事件配置" },
        { status: 400 },
      );
    }

    // 生成唯一ID和文件名
    let configId = generateConfigId();
    let filePath = join(CONFIG_DIR, `${configId}.json`);

    // 确保文件名不重复
    while (existsSync(filePath)) {
      configId = generateConfigId();
      filePath = join(CONFIG_DIR, `${configId}.json`);
    }

    // 保存配置
    const config = {
      id: configId,
      cards,
      events,
      createdAt: new Date().toISOString(),
    };

    await writeFile(filePath, JSON.stringify(config, null, 2));

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

    const filePath = join(CONFIG_DIR, `${configId}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 });
    }

    const content = await readFile(filePath, "utf-8");
    const config = JSON.parse(content);

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
