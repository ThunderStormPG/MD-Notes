import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded assets statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Real-time Collaboration State
const activeRooms = new Map<string, any[]>();

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ---
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, fullName },
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- WORKSPACES ---
app.get('/api/v1/workspaces', authenticateToken, async (req: any, res: any) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: req.user.id },
          { members: { some: { userId: req.user.id } } }
        ]
      }
    });
    res.json(workspaces);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/workspaces', authenticateToken, async (req: any, res: any) => {
  try {
    const { name } = req.body;
    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: req.user.id,
      },
    });
    // Add owner as Admin member
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: req.user.id,
        role: 'Admin'
      }
    });
    res.status(201).json(workspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- FOLDERS ---
app.get('/api/v1/workspaces/:id/folders', authenticateToken, async (req: any, res: any) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { workspaceId: req.params.id }
    });
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/workspaces/:id/folders', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, parentId } = req.body;
    const folder = await prisma.folder.create({
      data: {
        name,
        parentId,
        workspaceId: req.params.id
      }
    });
    res.status(201).json(folder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/workspaces/:id/notes', authenticateToken, async (req: any, res: any) => {
  try {
    const notes = await prisma.note.findMany({
      where: { workspaceId: req.params.id, isArchived: false },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/workspaces/:id/graph', authenticateToken, async (req: any, res: any) => {
  try {
    const notes = await prisma.note.findMany({
      where: { workspaceId: req.params.id, isArchived: false }
    });

    const nodes = notes.map(n => ({ id: n.id, name: n.title }));
    const links: any[] = [];
    
    const titleToId = new Map(notes.map(n => [n.title.toLowerCase(), n.id]));
    
    notes.forEach(note => {
      const content = note.contentMarkdown || '';
      const matches = [...content.matchAll(/\[\[(.*?)\]\]/g)];
      matches.forEach(match => {
        const targetTitle = match[1].toLowerCase();
        const targetId = titleToId.get(targetTitle);
        if (targetId && targetId !== note.id) {
          links.push({ source: note.id, target: targetId });
        }
      });
    });

    res.json({ nodes, links });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- NOTES ---
app.get('/api/v1/notes/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: req.params.id }
    });
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/notes', authenticateToken, async (req: any, res: any) => {
  try {
    const { workspaceId, folderId, title, contentMarkdown } = req.body;
    const note = await prisma.note.create({
      data: {
        workspaceId,
        folderId,
        authorId: req.user.id,
        title,
        contentMarkdown
      }
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/notes/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, contentMarkdown, frontmatter } = req.body;
    const note = await prisma.note.update({
      where: { id: req.params.id },
      data: { title, contentMarkdown, frontmatter }
    });
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- REAL-TIME COLLABORATION (SSE) ---
app.get('/api/v1/notes/:id/sync', (req: any, res: any) => {
  // Query param token auth for EventSource
  const token = req.query.token;
  if (!token) return res.status(401).send('Unauthorized');
  
  try {
    jwt.verify(token, JWT_SECRET);
  } catch(e) {
    return res.status(403).send('Forbidden');
  }

  const noteId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  if (!activeRooms.has(noteId)) {
    activeRooms.set(noteId, []);
  }
  activeRooms.get(noteId)?.push(res);
  
  req.on('close', () => {
    const clients = activeRooms.get(noteId)?.filter(client => client !== res) || [];
    activeRooms.set(noteId, clients);
  });
});

app.post('/api/v1/notes/:id/broadcast', authenticateToken, (req: any, res: any) => {
  const noteId = req.params.id;
  const data = req.body; 
  
  const roomClients = activeRooms.get(noteId) || [];
  roomClients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
  
  res.sendStatus(200);
});

// --- ASSETS ---
app.post('/api/v1/assets/upload', authenticateToken, async (req: any, res: any) => {
  try {
    const { fileName, base64Data } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ error: 'fileName and base64Data are required' });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const fileBuffer = Buffer.from(matches[2], 'base64');
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);
    
    fs.writeFileSync(filePath, fileBuffer);
    
    const url = `http://localhost:${PORT}/uploads/${safeName}`;
    res.status(201).json({ url, s3_key: safeName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
