import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { ApiResponse, ToolInfo, ToolCallResponse } from "@/lib/mcp/types";

// List tools for a server
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required parameter: serverId" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    const state = manager.getState(serverId);

    if (!state) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Server not found" },
        { status: 404 }
      );
    }

    if (state.status !== "connected") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Server is not connected" },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<ToolInfo[]>>({
      success: true,
      data: state.tools || [],
    });
  } catch (error) {
    console.error("MCP list tools error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list tools",
      },
      { status: 500 }
    );
  }
}

// Call a tool
export async function POST(request: NextRequest) {
  try {
    const { serverId, toolName, arguments: args } = await request.json();

    if (!serverId || !toolName) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required fields: serverId, toolName" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    const result = await manager.callTool(serverId, toolName, args);

    return NextResponse.json<ApiResponse<ToolCallResponse>>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("MCP call tool error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to call tool",
      },
      { status: 500 }
    );
  }
}

