"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const googleapis_1 = require("googleapis");
const msal_node_1 = require("@azure/msal-node");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import the session type augmentation
// import './types'; // Adjust the path if necessary
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = 3000;
// Google OAuth setup
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = 'http://localhost:3000/auth/google/callback';
const oauth2Client = new googleapis_1.google.auth.OAuth2(googleClientId, googleClientSecret, googleRedirectUri);
// Microsoft OAuth setup
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = 'http://localhost:3000/auth/callback';
const msalConfig = {
    auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
    },
};
const cca = new msal_node_1.ConfidentialClientApplication(msalConfig);
// Middleware for sessions
app.use((0, express_session_1.default)({
    secret: 'your-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set secure to true if using HTTPS
}));
// Google OAuth routes
app.get('/auth/google', (req, res) => {
    const state = 'google'; // Set the state parameter
    req.session.state = state; // Use type assertion
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
        state: state, // Pass the state parameter
    });
    res.redirect(url);
});
app.get('/auth/google/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, state } = req.query;
    if (state === req.session.state) { // Validate the state parameter
        try {
            const { tokens } = yield oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            req.session.googleTokens = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type,
                expiry_date: tokens.expiry_date,
            };
            res.send('Google account connected!');
        }
        catch (error) {
            console.error('Error retrieving Google access token', error);
            res.send('Error retrieving Google access token');
        }
    }
    else {
        res.send('Invalid state parameter');
    }
}));
// Outlook OAuth routes
app.get('/auth/outlook', (req, res) => {
    const state = 'outlook'; // Set the state parameter
    req.session.state = state; // Use type assertion
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
app.get('/auth/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, state } = req.query;
    if (state === req.session.state) { // Validate the state parameter
        try {
            const response = yield cca.acquireTokenByCode({
                code: code,
                scopes: ['https://graph.microsoft.com/.default'],
                redirectUri,
            });
            req.session.outlookToken = response === null || response === void 0 ? void 0 : response.accessToken;
            res.send('Outlook account connected!');
        }
        catch (error) {
            console.error('Error retrieving Outlook access token', error);
            res.send('Error retrieving Outlook access token');
        }
    }
    else {
        res.send('Invalid state parameter');
    }
}));
// Helper function to extract email details
const extractEmailDetails = (message) => {
    const headers = message.payload.headers;
    const getHeader = (name) => { var _a; return ((_a = headers.find((header) => header.name === name)) === null || _a === void 0 ? void 0 : _a.value) || 'Unknown'; };
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
app.get('/read-emails/google', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.session.googleTokens) {
        return res.status(401).send('Unauthorized');
    }
    oauth2Client.setCredentials(req.session.googleTokens);
    const gmail = googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
    try {
        const response = yield gmail.users.messages.list({ userId: 'me', maxResults: 20 });
        const messages = response.data.messages || [];
        const emailData = yield Promise.all(messages.map((message) => __awaiter(void 0, void 0, void 0, function* () {
            if (!message.id)
                return null;
            const msg = yield gmail.users.messages.get({ userId: 'me', id: message.id });
            return extractEmailDetails(msg.data);
        })));
        res.json(emailData.filter(email => email !== null));
    }
    catch (error) {
        console.error('Error reading Gmail emails', error);
        res.status(500).send('Error reading Gmail emails');
    }
}));
// Route to read Outlook emails
app.get('/read-emails/outlook', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.session.outlookToken;
    if (!token) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const response = yield axios_1.default.get('https://graph.microsoft.com/v1.0/me/messages', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        res.json(response.data.value);
    }
    catch (error) {
        console.error('Error reading Outlook emails', error);
        res.status(500).send('Error reading Outlook emails');
    }
}));
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
