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
  cookie: { secure: false }, // Set secure to true if using HTTPS
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

    // Log the tokens for debugging
    console.log('Tokens received:', tokens);

    req.session.tokens = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };

    // Save the session
    req.session.save(() => {
      res.send('Google account connected!');
    });
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.send('Error retrieving access token');
  }
});

// Helper function to extract email details
const extractEmailDetails = (message: any) => {
  const headers = message.payload.headers;
  const getHeader = (name: string) => headers.find((header: any) => header.name === name)?.value || 'Unknown';
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
    from: getHeader('From'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
  };
};

// Route to read emails
app.get('/read-emails', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).send('Unauthorized');
  }

  // Log the session tokens for debugging
  console.log('Session tokens:', req.session.tokens);

  oauth2Client.setCredentials(req.session.tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    const messages = response.data.messages || [];
    const emailData = await Promise.all(
      messages.map(async (message) => {
        if (!message.id) return null;  // Ensure message.id is defined
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id as string });
        return extractEmailDetails(msg.data);
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
