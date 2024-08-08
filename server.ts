import express from 'express';
import session from 'express-session';
import { google } from 'googleapis';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import axios from 'axios';
import dotenv from 'dotenv';

// Import the session type augmentation
// import './types'; // Adjust the path if necessary

dotenv.config();

const app = express();
const port = 3000;

// Google OAuth setup
const googleClientId = process.env.GOOGLE_CLIENT_ID as string;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
const googleRedirectUri = 'http://localhost:3000/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret, googleRedirectUri);

// Microsoft OAuth setup
const tenantId = process.env.TENANT_ID as string;
const clientId = process.env.CLIENT_ID as string;
const clientSecret = process.env.CLIENT_SECRET as string;
const redirectUri = 'http://localhost:3000/auth/callback';

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

// Middleware for sessions
app.use(session({
  secret: 'your-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Set secure to true if using HTTPS
}));

// Google OAuth routes
app.get('/auth/google', (req, res) => {
  const state = 'google'; // Set the state parameter
  (req.session as any).state = state; // Use type assertion
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    state: state, // Pass the state parameter
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state === (req.session as any).state) { // Validate the state parameter
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      req.session.googleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      };

      res.send('Google account connected!');
    } catch (error) {
      console.error('Error retrieving Google access token', error);
      res.send('Error retrieving Google access token');
    }
  } else {
    res.send('Invalid state parameter');
  }
});

// Outlook OAuth routes
app.get('/auth/outlook', (req, res) => {
  const state = 'outlook'; // Set the state parameter
  (req.session as any).state = state; // Use type assertion
  cca.getAuthCodeUrl({
    scopes: ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/Mail.Send'],
    redirectUri,
    state: state, // Pass the state parameter
  }).then((url) => {
    res.redirect(url);
  }).catch((error) => {
    console.error('Error generating auth URL', error);
    res.send('Error generating auth URL');
  });
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state === (req.session as any).state) { // Validate the state parameter
    try {
      const response = await cca.acquireTokenByCode({
        code: code as string,
        scopes: ['https://graph.microsoft.com/.default'],
        redirectUri,
      });

      req.session.outlookToken = response?.accessToken;

      res.send('Outlook account connected!');
    } catch (error) {
      console.error('Error retrieving Outlook access token', error);
      res.send('Error retrieving Outlook access token');
    }
  } else {
    res.send('Invalid state parameter');
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

// Route to read Gmail emails
app.get('/read-emails/google', async (req, res) => {
  if (!req.session.googleTokens) {
    return res.status(401).send('Unauthorized');
  }

  oauth2Client.setCredentials(req.session.googleTokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    const messages = response.data.messages || [];
    const emailData = await Promise.all(
      messages.map(async (message) => {
        if (!message.id) return null;
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id as string });
        return extractEmailDetails(msg.data);
      })
    );
    res.json(emailData.filter(email => email !== null));
  } catch (error) {
    console.error('Error reading Gmail emails', error);
    res.status(500).send('Error reading Gmail emails');
  }
});

// Route to read Outlook emails
app.get('/read-emails/outlook', async (req, res) => {
  const token = req.session.outlookToken;

  if (!token) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    res.json(response.data.value);
  } catch (error) {
    console.error('Error reading Outlook emails', error);
    res.status(500).send('Error reading Outlook emails');
  }
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
