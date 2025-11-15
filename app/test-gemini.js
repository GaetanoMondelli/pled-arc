const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
const envLocal = fs.readFileSync('.env.local', 'utf8');
const envLines = envLocal.split('\n');
for (const line of envLines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

async function testGemini() {
  try {
    console.log('🧪 Testing Gemini API...\n');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('❌ No API key found in environment');
      process.exit(1);
    }

    console.log('✅ API key found');
    console.log('🔑 Key starts with:', apiKey.substring(0, 10) + '...\n');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Test with the first model in fallbacks
    const models = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-exp', 'gemini-2.0-flash'];

    for (const modelName of models) {
      try {
        console.log(`🤖 Trying model: ${modelName}`);

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.5,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 1024,
          }
        });

        const prompt = 'Generate a simple JSON object with fields: name, age, city. Return ONLY the JSON, no markdown.';

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`✅ Response received from ${modelName}:\n`);
        console.log(text);
        console.log('\n---\n');

        // Try to parse as JSON
        try {
          let jsonText = text.trim();
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
          }
          const parsed = JSON.parse(jsonText);
          console.log('✅ Successfully parsed as JSON:', parsed);
        } catch (e) {
          console.log('⚠️  Response is not valid JSON, but API works');
        }

        console.log('\n🎉 Gemini API is working!\n');
        process.exit(0);

      } catch (error) {
        console.log(`❌ Model ${modelName} failed: ${error.message}`);
        console.log('   Trying next model...\n');
      }
    }

    console.log('❌ All models failed');
    process.exit(1);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testGemini();
