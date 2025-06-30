import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';

// POST /api/chat/upload - Upload files for multimodal messages
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (5MB max for better performance)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Convert file to buffer for validation
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate actual file type using file-type library
    const detectedType = await fileTypeFromBuffer(buffer);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!detectedType || 
        !allowedMimeTypes.includes(detectedType.mime) ||
        !allowedExtensions.includes(detectedType.ext)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      }, { status: 400 });
    }

    // Additional security: check for malicious patterns
    const bufferString = buffer.toString('hex', 0, Math.min(buffer.length, 1024));
    const maliciousPatterns = [
      '3c73637269707420', // <script
      '6a617661736372697074', // javascript
      '2e2e2f', // ../
    ];
    
    if (maliciousPatterns.some(pattern => bufferString.includes(pattern))) {
      return NextResponse.json({ error: 'File contains potentially malicious content' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename with detected extension
    const uniqueFilename = `${uuidv4()}.${detectedType.ext}`;
    const filePath = join(uploadsDir, uniqueFilename);

    // Save file
    await writeFile(filePath, buffer);

    // Return the URL for accessing the uploaded file
    const url = `/uploads/${uniqueFilename}`;

    return NextResponse.json({
      url,
      filename: file.name,
      size: file.size,
      mimeType: detectedType.mime,
      detectedExtension: detectedType.ext
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}