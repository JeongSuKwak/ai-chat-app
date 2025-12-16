import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { ApiResponse, ResourceInfo, ResourceReadResponse } from "@/lib/mcp/types";

// List resources for a server
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

    return NextResponse.json<ApiResponse<ResourceInfo[]>>({
      success: true,
      data: state.resources || [],
    });
  } catch (error) {
    console.error("MCP list resources error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list resources",
      },
      { status: 500 }
    );
  }
}

// Read a resource
export async function POST(request: NextRequest) {
  try {
    const { serverId, uri } = await request.json();

    if (!serverId || !uri) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Missing required fields: serverId, uri" },
        { status: 400 }
      );
    }

    const manager = getGlobalMcpClientManager();
    const result = await manager.readResource(serverId, uri);

    return NextResponse.json<ApiResponse<ResourceReadResponse>>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("MCP read resource error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read resource",
      },
      { status: 500 }
    );
  }
}

