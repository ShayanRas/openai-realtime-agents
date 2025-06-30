import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { processChatMessage } from '@/app/lib/chat-agents';

// POST /api/chat/completion - Get AI response for a message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadId, message, attachments = [] } = body;

    if (!threadId || !message) {
      return NextResponse.json({ error: 'Thread ID and message required' }, { status: 400 });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        threadId,
        role: 'USER',
        content: message,
        contentType: attachments.length > 0 ? 'MULTIMODAL' : 'TEXT',
        attachments: {
          create: attachments.map((att: any) => ({
            type: att.type,
            url: att.url,
            filename: att.filename,
            size: att.size,
            mimeType: att.mimeType,
          })),
        },
      },
      include: {
        attachments: true,
      },
    });

    // Get AI response
    const aiResponse = await processChatMessage(threadId, message, attachments);

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        threadId,
        role: aiResponse.role,
        content: aiResponse.content,
        contentType: 'TEXT',
      },
    });

    // Update thread
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('Error in chat completion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}