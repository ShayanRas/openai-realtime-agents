import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// GET /api/chat/threads - Get all threads for a session
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const threads = await prisma.thread.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/threads - Create a new thread
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { title, firstMessage } = body;

    // Ensure session exists
    let session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      session = await prisma.session.create({
        data: { id: sessionId }
      });
    }

    // Create thread
    const thread = await prisma.thread.create({
      data: {
        sessionId,
        title: title || 'New Conversation',
        mode: 'CHAT'
      }
    });

    // Create first message if provided
    if (firstMessage) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          role: 'USER',
          content: firstMessage,
          contentType: 'TEXT'
        }
      });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}