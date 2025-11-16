const fs = require('fs');
const path = require('path');

async function uploadTemplate() {
  const templatePath = path.join(__dirname, 'workflows', 'dao-house-simple-v3.json');
  const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  console.log('📤 Uploading V3 template...');
  console.log('Template ID:', templateData.id);
  console.log('Version:', templateData.version);

  try {
    const response = await fetch('http://localhost:3000/api/admin/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Upload failed:', error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Template uploaded successfully!');
    console.log('Template ID:', result.template.id);
    console.log('Template editor URL:', `http://localhost:3000/template-editor/${result.template.id}`);

    return result.template;
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    process.exit(1);
  }
}

uploadTemplate();
