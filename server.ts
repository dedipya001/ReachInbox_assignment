import { google } from 'googleapis';
import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI as string;

app.use(session({
  secret: 'your-secret',
  resave: false,
  saveUninitialized: true,
}));

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Route to start the OAuth process
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
  });
  res.redirect(url);
});

// OAuth callback route
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    req.session.tokens = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };
    res.send('Google account connected!');
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.send('Error retrieving access token');
  }
});

// Route to read emails
app.get('/read-emails', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).send('Unauthorized');
  }

  oauth2Client.setCredentials(req.session.tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    const messages = response.data.messages || [];
    const emailData = await Promise.all(
      messages.map(async (message) => {
        if (!message.id) return null;  // Ensure message.id is defined
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id as string });
        return msg.data;
      })
    );
    res.json(emailData.filter(email => email !== null));  // Filter out any null values
  } catch (error) {
    console.error('Error reading emails', error);
    res.status(500).send('Error reading emails');
  }
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
