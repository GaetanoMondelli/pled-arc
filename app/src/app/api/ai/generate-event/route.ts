import { NextRequest, NextResponse } from 'next/server';
import { getAIModel } from '@/lib/ai-config';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const model = getAIModel('fast');

    const fullPrompt = `You are a helpful assistant that generates realistic JSON data for API responses and events.

User request: ${prompt}

Generate ONLY valid JSON data that matches the user's description. Do not include any explanations, markdown formatting, or code blocks - just return the raw JSON object.

The JSON should be realistic and include appropriate field names, data types, and sample values that would appear in a real API response.

Examples:
- If asked for "OpenAI chat completion response", generate JSON with fields like: id, object, created, model, choices (with message, role, content), usage (prompt_tokens, completion_tokens, total_tokens)
- If asked for "Weather API response", generate JSON with: location, temperature, humidity, conditions, forecast, etc.
- If asked for "User profile data", generate JSON with: id, name, email, avatar, createdAt, etc.

Return ONLY the JSON, nothing else.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response from Gemini
    let generatedData;
    try {
      // Clean up the response - remove any potential markdown formatting
      let jsonText = text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      generatedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', text);
      return NextResponse.json(
        { success: false, error: 'Generated response was not valid JSON', raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: generatedData
    });

  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate event data'
      },
      { status: 500 }
    );
  }
}
