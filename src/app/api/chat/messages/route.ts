import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

// GET /api/chat/messages?threadId=xxx - Get messages for a thread
export async function GET(request: NextRequest) {
  try {
    const threadId = request.nextUrl.searchParams.get('threadId');
    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
    }

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: true
      }
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadId, content, role = 'USER', contentType = 'TEXT', attachments = [], externalId } = body;

    if (!threadId || !content) {
      return NextResponse.json({ error: 'Thread ID and content required' }, { status: 400 });
    }

    // Check if message with externalId already exists
    if (externalId) {
      const existing = await prisma.message.findUnique({
        where: { externalId }
      });
      
      if (existing) {
        // Update existing message instead of creating new one
        const message = await prisma.message.update({
          where: { externalId },
          data: { content },
          include: { attachments: true }
        });
        return NextResponse.json({ message });
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        threadId,
        role,
        content,
        contentType,
        externalId,
        attachments: {
          create: attachments.map((att: any) => ({
            type: att.type,
            url: att.url,
            filename: att.filename,
            size: att.size,
            mimeType: att.mimeType,
            metadata: att.metadata
          }))
        }
      },
      include: {
        attachments: true
      }
    });

    // Update thread's updatedAt
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/chat/messages - Update a message
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadId, externalId, content } = body;

    if (!externalId || !content) {
      return NextResponse.json({ error: 'External ID and content required' }, { status: 400 });
    }

    // Update message by externalId
    const message = await prisma.message.update({
      where: { externalId },
      data: { content },
      include: { attachments: true }
    });

    // Update thread's updatedAt if threadId provided
    if (threadId) {
      await prisma.thread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() }
      });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}