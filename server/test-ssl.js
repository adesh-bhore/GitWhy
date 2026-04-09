// Quick SSL test script
import https from 'https';

console.log('Node version:', process.version);
console.log('OpenSSL version:', process.versions.openssl);

// Test Grok API
console.log('\nTesting Grok API...');
https.get('https://api.x.ai', (res) => {
  console.log('Grok API - Status:', res.statusCode);
}).on('error', (err) => {
  console.error('Grok API - Error:', err.message);
});

// Test Voyage AI
console.log('Testing Voyage AI...');
https.get('https://api.voyageai.com', (res) => {
  console.log('Voyage API - Status:', res.statusCode);
}).on('error', (err) => {
  console.error('Voyage API - Error:', err.message);
});

setTimeout(() => {
  console.log('\nTest complete');
  process.exit(0);
}, 5000);
