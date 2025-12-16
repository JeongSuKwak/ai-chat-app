import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { ApiResponse, McpServerState } from "@/lib/mcp/types";

// Get status of a specific server or all servers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    const manager = getGlobalMcpClientManager();

    if (serverId) {
      const state = manager.getState(serverId);
      if (!state) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Server not found" },
          { status: 404 }
        );
      }
      return NextResponse.json<ApiResponse<McpServerState>>({
        success: true,
        data: state,
      });
    }

    // Return all states
    const states = manager.getAllStates();
    return NextResponse.json<ApiResponse<McpServerState[]>>({
      success: true,
      data: states,
    });
  } catch (error) {
    console.error("MCP status error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}

