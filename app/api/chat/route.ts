import { GoogleGenAI, mcpToTool, FunctionCallingConfigMode } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getGlobalMcpClientManager } from "@/lib/mcp/global-client-manager";
import type { McpServerConfig, ToolInfo } from "@/lib/mcp/types";

// Increase timeout for MCP connections
export const maxDuration = 60;

// Event types for SSE
interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
  serverId: string;
}

interface ToolResultEvent {
  type: "tool_result";
  toolName: string;
  result: string;
  serverId: string;
}

interface TextEvent {
  type: "text";
  content: string;
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type StreamEvent = ToolCallEvent | ToolResultEvent | TextEvent | ErrorEvent;

function createEventString(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Ensure MCP servers are connected
 */
async function ensureMcpConnections(
  serverConfigs: McpServerConfig[]
): Promise<string[]> {
  const manager = getGlobalMcpClientManager();
  const connectedIds: string[] = [];

  for (const config of serverConfigs) {
    try {
      if (!manager.isConnected(config.id)) {
        console.log(`[Chat API] Connecting to MCP server: ${config.name}`);
        await manager.connect(config);
      }
      
      if (manager.isConnected(config.id)) {
        connectedIds.push(config.id);
      }
    } catch (error) {
      console.error(`[Chat API] Failed to connect to ${config.name}:`, error);
    }
  }

  return connectedIds;
}

/**
 * Get MCP tools for Claude
 */
interface McpTool extends ToolInfo {
  serverId: string;
  serverName: string;
}

function getMcpToolsForClaude(connectedIds: string[]): McpTool[] {
  const manager = getGlobalMcpClientManager();
  const tools: McpTool[] = [];

  for (const serverId of connectedIds) {
    const state = manager.getState(serverId);
    if (state?.status === "connected" && state.tools) {
      for (const tool of state.tools) {
        tools.push({
          ...tool,
          serverId: state.config.id,
          serverName: state.config.name,
        });
      }
    }
  }

  return tools;
}

function convertToClaudeTool(tool: McpTool): Anthropic.Tool {
  const toolId = `${tool.serverId}__${tool.name}`;
  const schema = tool.inputSchema || {};
  const requiredFields = Array.isArray(schema.required) ? schema.required : [];
  
  return {
    name: toolId,
    description: tool.description || `Tool from ${tool.serverName}`,
    input_schema: {
      type: "object" as const,
      properties: (schema.properties as Record<string, unknown>) || {},
      required: requiredFields,
    },
  };
}

async function executeMcpTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<string> {
  const manager = getGlobalMcpClientManager();

  const parts = toolId.split("__");
  if (parts.length < 2) {
    throw new Error(`Invalid tool ID format: ${toolId}`);
  }

  const serverId = parts[0];
  const toolName = parts.slice(1).join("__");

  try {
    const result = await manager.callTool(serverId, toolName, args);

    if (result.content && Array.isArray(result.content)) {
      return result.content
        .map((item) => {
          if (item.type === "text") return item.text;
          return JSON.stringify(item);
        })
        .join("\n");
    }

    return JSON.stringify(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error executing tool: ${errorMessage}`;
  }
}

/**
 * Handle Gemini chat with MCP tools
 */
async function handleGeminiChat(
  messages: Array<{ role: string; content: string }>,
  mcpServers: McpServerConfig[],
  mcpEnabled: boolean,
  model: string
): Promise<ReadableStream> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const manager = getGlobalMcpClientManager();

  // Ensure MCP connections if enabled
  let connectedServerIds: string[] = [];
  if (mcpEnabled && mcpServers && mcpServers.length > 0) {
    connectedServerIds = await ensureMcpConnections(mcpServers);
  }

  // Get MCP clients for connected servers
  const mcpClients = connectedServerIds
    .map(id => manager.getClient(id))
    .filter((client): client is NonNullable<typeof client> => client !== undefined);

  // Build tools array using mcpToTool
  const tools = mcpClients.length > 0 
    ? mcpClients.map(client => mcpToTool(client))
    : [];

  // Convert messages to Gemini format
  const geminiContents = messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const response = await ai.models.generateContent({
          model: model || "gemini-2.5-flash",
          contents: geminiContents,
          config: {
            tools: tools.length > 0 ? tools : undefined,
            toolConfig: tools.length > 0 ? {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO,
              },
            } : undefined,
          },
        });

        const text = response.text;
        
        if (text) {
          const event: TextEvent = { type: "text", content: text };
          controller.enqueue(encoder.encode(createEventString(event)));
        }

        if (response.functionCalls && response.functionCalls.length > 0) {
          for (const fc of response.functionCalls) {
            const toolCallEvent: ToolCallEvent = {
              type: "tool_call",
              toolName: fc.name || "unknown",
              args: (fc.args as Record<string, unknown>) || {},
              serverId: "auto",
            };
            controller.enqueue(encoder.encode(createEventString(toolCallEvent)));
          }
        }

        controller.close();
      } catch (err) {
        console.error("Gemini chat error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        const errorEvent: ErrorEvent = { type: "error", message: errorMessage };
        controller.enqueue(encoder.encode(createEventString(errorEvent)));
        controller.close();
      }
    },
  });
}

/**
 * Handle Claude chat with MCP tools
 */
async function handleClaudeChat(
  messages: Array<{ role: string; content: string }>,
  mcpServers: McpServerConfig[],
  mcpEnabled: boolean,
  model: string
): Promise<ReadableStream> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Ensure MCP connections if enabled
  let connectedServerIds: string[] = [];
  if (mcpEnabled && mcpServers && mcpServers.length > 0) {
    connectedServerIds = await ensureMcpConnections(mcpServers);
  }

  // Get MCP tools
  const mcpTools = getMcpToolsForClaude(connectedServerIds);

  // Convert messages to Claude format
  const claudeMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Build request parameters
        const requestParams: Anthropic.MessageCreateParams = {
          model: model || "claude-sonnet-4-20250514",
          max_tokens: 8192,
          messages: claudeMessages,
        };

        // Add tools if available
        if (mcpTools.length > 0) {
          requestParams.tools = mcpTools.map(convertToClaudeTool);
        }

        let response = await anthropic.messages.create(requestParams);

        // Handle tool use in a loop
        while (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );

          // Stream any text before tool use
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              const event: TextEvent = { type: "text", content: block.text };
              controller.enqueue(encoder.encode(createEventString(event)));
            }
          }

          // Process tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            // Extract display name and server ID
            const toolNameParts = toolUse.name.split("__");
            const displayToolName = toolNameParts.length > 1
              ? toolNameParts[toolNameParts.length - 1]
              : toolUse.name;
            const serverId = toolNameParts.length > 1 ? toolNameParts[0] : "unknown";

            // Send tool call event
            const toolCallEvent: ToolCallEvent = {
              type: "tool_call",
              toolName: displayToolName,
              args: toolUse.input as Record<string, unknown>,
              serverId,
            };
            controller.enqueue(encoder.encode(createEventString(toolCallEvent)));

            const toolResult = await executeMcpTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );

            // Send tool result event
            const toolResultEvent: ToolResultEvent = {
              type: "tool_result",
              toolName: displayToolName,
              result: toolResult,
              serverId,
            };
            controller.enqueue(encoder.encode(createEventString(toolResultEvent)));

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: toolResult,
            });
          }

          // Continue conversation with tool results
          const updatedMessages: Anthropic.MessageParam[] = [
            ...claudeMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ];

          response = await anthropic.messages.create({
            model: model || "claude-sonnet-4-20250514",
            max_tokens: 8192,
            messages: updatedMessages,
            tools: mcpTools.length > 0 ? mcpTools.map(convertToClaudeTool) : undefined,
          });
        }

        // Stream the final text response
        for (const block of response.content) {
          if (block.type === "text" && block.text) {
            const event: TextEvent = { type: "text", content: block.text };
            controller.enqueue(encoder.encode(createEventString(event)));
          }
        }

        controller.close();
      } catch (err) {
        console.error("Claude chat error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        const errorEvent: ErrorEvent = { type: "error", message: errorMessage };
        controller.enqueue(encoder.encode(createEventString(errorEvent)));
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  console.log("=== Chat API Request Started ===");
  
  try {
    const body = await req.json();
    const { messages, mcpServers, mcpEnabled = true, model, provider = "gemini" } = body;
    
    console.log("Provider:", provider);
    console.log("Model:", model);
    console.log("Messages count:", messages?.length);
    console.log("MCP Servers count:", mcpServers?.length);
    console.log("MCP Enabled:", mcpEnabled);

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    let stream: ReadableStream;

    if (provider === "claude") {
      stream = await handleClaudeChat(messages, mcpServers || [], mcpEnabled, model);
    } else {
      stream = await handleGeminiChat(messages, mcpServers || [], mcpEnabled, model);
    }

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Error in chat route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
