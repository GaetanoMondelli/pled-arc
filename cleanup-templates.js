async function cleanupTemplates() {
  const response = await fetch('http://localhost:3000/api/admin/templates');
  const data = await response.json();

  console.log('=== ALL TEMPLATES ===');
  data.templates.forEach(t => {
    console.log(`[${t.name}] ID: ${t.id}`);
  });

  console.log('\n=== DAO HOUSE TEMPLATES ===');
  const daoTemplates = data.templates.filter(t =>
    t.name === 'DAO House P&L Complete Flow' ||
    t.name.includes('DAO House')
  );

  console.log('Total DAO House templates:', daoTemplates.length);
  console.log('KEEP: oypjt7e3uUPnxB4tjlQlU');

  const toDelete = daoTemplates.filter(t => t.id !== 'oypjt7e3uUPnxB4tjlQlU');

  console.log('\nWill DELETE these', toDelete.length, 'DAO House templates:');
  toDelete.forEach(t => console.log('  ❌', t.id, '-', t.name));

  console.log('\n=== OTHER TEMPLATES (WILL KEEP) ===');
  const otherTemplates = data.templates.filter(t =>
    t.name !== 'DAO House P&L Complete Flow' &&
    !t.name.includes('DAO House')
  );
  otherTemplates.forEach(t => console.log('  ✅', t.id, '-', t.name));

  console.log('\n=== EXPECTED FINAL COUNT ===');
  console.log('DAO House templates: 1 (oypjt7e3uUPnxB4tjlQlU)');
  console.log('Other templates:', otherTemplates.length);
  console.log('Total:', 1 + otherTemplates.length);
}

cleanupTemplates();
