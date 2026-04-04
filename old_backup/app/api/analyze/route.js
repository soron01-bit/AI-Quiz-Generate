import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    console.log("Analyze API Route Hit!");
    const { fileUrl, userId, fileName } = await request.json();
    console.log("Received data: ", { fileUrl, userId, fileName });

    if (!fileUrl || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch PDF from URL
    const fileResponse = await fetch(fileUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Parse text from PDF
    const pdfData = await pdfParse(buffer);
    const textContext = pdfData.text;

    if (!textContext || textContext.length < 50) {
      return NextResponse.json({ error: 'Could not extract enough text from PDF.' }, { status: 400 });
    }

    // 3. Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert AI tutor. Based on the following document text, create a high-quality quiz.
      Generate exactly 5 multiple-choice questions that test understanding of the core concepts in the text.
      Format your response ONLY as a JSON object, exactly matching this structure, with no markdown code blocks:
      {
        "title": "A fitting title for this quiz",
        "questions": [
          {
            "question": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswerIndex": 0,
            "explanation": "Brief explanation of why this is correct."
          }
        ]
      }
      
      Document text:
      ${textContext.substring(0, 30000)} // Limit context to 30000 chars to be safe
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text();
    
    // Clean up if Gemini accidentally returns markdown code blocks
    jsonText = jsonText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    
    const quizData = JSON.parse(jsonText);

    // 4. Save to Firestore
    const docRef = await addDoc(collection(db, "quizzes"), {
      userId,
      fileName,
      title: quizData.title,
      questions: quizData.questions,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, quizId: docRef.id });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
