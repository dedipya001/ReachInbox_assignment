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
const googleapis_1 = require("googleapis");
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = 3000;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
app.use((0, express_session_1.default)({
    secret: 'your-secret',
    resave: false,
    saveUninitialized: true,
}));
const oauth2Client = new googleapis_1.google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
// Route to start the OAuth process
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    });
    res.redirect(url);
});
// OAuth callback route
app.get('/auth/google/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.query;
    try {
        const { tokens } = yield oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        req.session.tokens = {
            access_token: tokens.access_token || undefined,
            refresh_token: tokens.refresh_token || undefined,
            scope: tokens.scope || undefined,
            token_type: tokens.token_type || undefined,
            expiry_date: tokens.expiry_date || undefined,
        };
        res.send('Google account connected!');
    }
    catch (error) {
        console.error('Error retrieving access token', error);
        res.send('Error retrieving access token');
    }
}));
// Route to read emails
app.get('/read-emails', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.session.tokens) {
        return res.status(401).send('Unauthorized');
    }
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
    try {
        const response = yield gmail.users.messages.list({ userId: 'me', maxResults: 20 });
        const messages = response.data.messages || [];
        const emailData = yield Promise.all(messages.map((message) => __awaiter(void 0, void 0, void 0, function* () {
            if (!message.id)
                return null; // Ensure message.id is defined
            const msg = yield gmail.users.messages.get({ userId: 'me', id: message.id });
            return msg.data;
        })));
        res.json(emailData.filter(email => email !== null)); // Filter out any null values
    }
    catch (error) {
        console.error('Error reading emails', error);
        res.status(500).send('Error reading emails');
    }
}));
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
