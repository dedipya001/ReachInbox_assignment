import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

// Function to analyze email context and generate labels
const analyzeEmailContext = async (emailContent: string) => {
  try {
    const response = await openai.completions.create({
        model: 'gpt-3.5-turbo', // Change to an available model
        prompt: emailContent,
      max_tokens: 50,
    });

    const analysis = response.choices[0]?.text;

    // Determine labels based on analysis
    if (analysis?.includes('interested')) return 'Interested';
    if (analysis?.includes('not interested')) return 'Not Interested';
    if (analysis?.includes('more information')) return 'More Information';
    return 'Unclassified';
  } catch (error) {
    console.error('Error analyzing email context:', error);
    throw new Error('Failed to analyze email context');
  }
};

export default analyzeEmailContext;
