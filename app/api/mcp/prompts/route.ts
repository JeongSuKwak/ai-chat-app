import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { ApiResponse, PromptInfo, PromptGetResponse } from "@/lib/mcp/types";

// List prompts for a server
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

    return NextResponse.json<ApiResponse<PromptInfo[]>>({
      success: true,
      data: state.prompts || [],
    });
  } catch (error) {
    console.error("MCP list prompts error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list prompts",
      },
      { status: 500 }
    );
  }
}

// Get a prompt
export async function POST(request: NextRequest) {
  try {
    const { serverId, promptName, arguments: args } = await request.json();

    if (!serverId || !promptName) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required fields: serverId, promptName" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    const result = await manager.getPrompt(serverId, promptName, args);

    return NextResponse.json<ApiResponse<PromptGetResponse>>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("MCP get prompt error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get prompt",
      },
      { status: 500 }
    );
  }
}

