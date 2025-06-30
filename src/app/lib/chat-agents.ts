import { prisma } from './prisma';
import { env } from './env';
import OpenAI from 'openai';
import { Parser } from 'expr-eval';

// Initialize OpenAI client with validated environment
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Safe calculator function using expr-eval library
function safeCalculate(expression: string): number | string {
  try {
    // Basic validation - limit expression length
    if (expression.length > 100) {
      return 'Expression too long';
    }
    
    // Use expr-eval parser for safe evaluation
    const parser = new Parser();
    const expr = parser.parse(expression);
    const result = expr.evaluate();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return 'Invalid mathematical expression';
    }
    
    return result;
  } catch (error) {
    return 'Error evaluating expression: ' + (error instanceof Error ? error.message : 'Unknown error');
  }
}

// Define available tools for function calling
const availableTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform basic mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2" or "sin(0.5)")',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// Execute tool calls
async function executeToolCall(toolCall: OpenAI.Chat.ChatCompletionMessageToolCall) {
  const { name, arguments: args } = toolCall.function;
  
  switch (name) {
    case 'calculator':
      const { expression } = JSON.parse(args);
      const result = safeCalculate(expression);
      return { result };
      
    case 'get_current_time':
      return {
        current_time: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Function to process chat messages with multimodal support
export async function processChatMessage(
  threadId: string,
  userMessage: string,
  attachments: any[] = []
) {
  try {
    // Get conversation history
    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      include: { attachments: true },
      take: 50, // Limit history to last 50 messages
    });

    // System message
    const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'system',
      content: `You are a helpful, friendly AI assistant with multimodal capabilities.
You can help users with a wide variety of tasks including:
- Answering questions and providing information
- Analyzing images and visual content
- Performing calculations using the calculator tool
- Getting current time information
- Having natural conversations

Be concise but thorough in your responses. When users share images, analyze them carefully and provide detailed descriptions or answer questions about them.

Use the available tools when appropriate to provide accurate information.`,
    };

    // Convert database messages to OpenAI format
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [systemMessage];

    for (const msg of messages) {
      if (msg.role === 'USER') {
        const content: any[] = [{ type: 'text', text: msg.content }];
        
        // Add image attachments
        if (msg.attachments.length > 0) {
          msg.attachments.forEach((att) => {
            if (att.type === 'image') {
              const imageUrl = att.url.startsWith('http') 
                ? att.url 
                : `${env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${att.url}`;
              content.push({
                type: 'image_url',
                image_url: { url: imageUrl },
              });
            }
          });
        }

        openaiMessages.push({
          role: 'user',
          content,
        });
      } else if (msg.role === 'ASSISTANT') {
        openaiMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    // Add the new user message
    const newUserContent: any[] = [{ type: 'text', text: userMessage }];
    attachments.forEach((att) => {
      if (att.type === 'image') {
        const imageUrl = att.url.startsWith('http') 
          ? att.url 
          : `${env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${att.url}`;
        newUserContent.push({
          type: 'image_url',
          image_url: { url: imageUrl },
        });
      }
    });

    openaiMessages.push({
      role: 'user',
      content: newUserContent,
    });

    // Get response from OpenAI with tools
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      tools: availableTools,
      tool_choice: 'auto',
      max_tokens: 1000,
      temperature: 0.7,
    });

    const choice = completion.choices[0];
    let assistantMessage = choice.message.content || '';

    // Handle tool calls if present
    if (choice.message.tool_calls) {
      const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [...openaiMessages];
      
      // Add assistant message with tool calls
      toolMessages.push(choice.message);

      // Execute tool calls
      for (const toolCall of choice.message.tool_calls) {
        const toolResult = await executeToolCall(toolCall);
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Get final response after tool execution
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: toolMessages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      assistantMessage = finalCompletion.choices[0].message.content || '';
    }

    return {
      content: assistantMessage,
      role: 'ASSISTANT' as const,
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw new Error('Failed to process chat message');
  }
}