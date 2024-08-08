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
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize the OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Function to analyze email context and generate labels
const analyzeEmailContext = (emailContent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const response = yield openai.completions.create({
            model: 'gpt-3.5-turbo', // Change to an available model
            prompt: emailContent,
            max_tokens: 50,
        });
        const analysis = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.text;
        // Determine labels based on analysis
        if (analysis === null || analysis === void 0 ? void 0 : analysis.includes('interested'))
            return 'Interested';
        if (analysis === null || analysis === void 0 ? void 0 : analysis.includes('not interested'))
            return 'Not Interested';
        if (analysis === null || analysis === void 0 ? void 0 : analysis.includes('more information'))
            return 'More Information';
        return 'Unclassified';
    }
    catch (error) {
        console.error('Error analyzing email context:', error);
        throw new Error('Failed to analyze email context');
    }
});
exports.default = analyzeEmailContext;
