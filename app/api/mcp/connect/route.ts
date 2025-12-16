import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { McpServerConfig, ApiResponse, McpServerState } from "@/lib/mcp/types";

export async function POST(request: NextRequest) {
  try {
    const config: McpServerConfig = await request.json();

    if (!config.id || !config.name || !config.transport) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required fields: id, name, transport" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    const state = await manager.connect(config);

    return NextResponse.json<ApiResponse<McpServerState>>({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error("MCP connect error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect",
      },
      { status: 500 }
    );
  }
}

