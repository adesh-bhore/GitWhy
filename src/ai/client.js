import { GoogleGenerativeAI } from '@google/generative-ai';

// Single shared Gemini client — reads GEMINI_API_KEY from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const gemini = genAI.getGenerativeModel({
  model: process.env.GITWHY_MODEL || 'gemini-2.0-flash'
});

