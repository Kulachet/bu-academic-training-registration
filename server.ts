import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Calendar API Setup
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // API Routes
  app.post('/api/calendar/create', async (req, res) => {
    const { instructorEmail, courseTitle, courseDate, startTime, endTime, courseRoom, instructorName } = req.body;

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Google Calendar credentials not configured' });
    }

    try {
      // courseDate is YYYY-MM-DD, startTime/endTime are HH:mm
      const startDateTime = new Date(`${courseDate}T${startTime}:00`);
      const endDateTime = new Date(`${courseDate}T${endTime}:00`);

      const event = {
        summary: `อบรม: ${courseTitle}`,
        location: courseRoom || 'มหาวิทยาลัยกรุงเทพ',
        description: `การลงทะเบียนอบรมวิชาการสำหรับ ${instructorName}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Asia/Bangkok',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Bangkok',
        },
        attendees: [
          { email: instructorEmail },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      const response = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
        sendUpdates: 'all', // This sends the email invitation
      });

      res.json({ success: true, eventId: response.data.id });
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: error.message || 'Failed to create calendar event' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
