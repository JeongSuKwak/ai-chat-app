import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { ApiResponse } from "@/lib/mcp/types";

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();

    if (!serverId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required field: serverId" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    await manager.disconnect(serverId);

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error("MCP disconnect error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect",
      },
      { status: 500 }
    );
  }
}

